(() => {
  const platform = "whatsapp_web";
  /** Bumped with manifest — heartbeat must show this or WA page needs refresh. */
  const CONTENT_BUILD = "1.0.19-bridge-resilience";
  const OUTBOUND_QUEUE_KEY = "conciergeOutboundQueue";
  const MAX_OUTBOUND_ATTEMPTS = 5;
  /** Guest message fingerprint fully consumed (turn done; no further engine/send). */
  let lastFingerprint = "";
  let lastFingerprintAt = 0;
  /** Same-thread identical guest text already answered in this tab session. */
  let lastTextFingerprint = "";
  let lastTextFingerprintAt = 0;
  /** Local dedupe TTL — after this, same text (new test) can run again. */
  const FINGERPRINT_TTL_MS = 45_000;
  /** Min gap between auto-opening an unread chat (avoid list thrash). */
  const UNREAD_OPEN_COOLDOWN_MS = 1200;
  /**
   * Fingerprints for which we already executed a send click/Enter.
   * Critical: real WhatsApp may deliver the message even if .message-out
   * verification fails — never click twice for the same guest message.
   */
  const outboundDispatchFingerprints = new Set();
  /** Fingerprints currently inside ingest/turn/send — blocks concurrent ticks. */
  const processingFingerprints = new Set();
  let leader = null;
  let connected = true;
  let tickInFlight = false;
  let failedLeaderTicks = 0;
  let lastUnreadOpenAt = 0;
  /** Last agent text we dispatched — ignore if DOM mis-reads it as guest. */
  let lastOutboundText = "";
  /** Thread that owned lastOutboundText / in-flight turn — reset on chat switch. */
  let lastSeenThreadId = null;
  let turnBoundThreadId = null;
  const channelQueue = window.PragmaConcierge.createChannelTurnQueue();

  function resetLocalChatSession(reason) {
    lastOutboundText = "";
    lastFingerprint = "";
    lastFingerprintAt = 0;
    lastTextFingerprint = "";
    lastTextFingerprintAt = 0;
    turnBoundThreadId = null;
    // Keep outboundDispatchFingerprints — keys are already thread-scoped.
    void reason;
  }

  function noteThreadChange(threadId) {
    if (!threadId) return;
    if (lastSeenThreadId && lastSeenThreadId !== threadId) {
      resetLocalChatSession("chat_switch");
    }
    lastSeenThreadId = threadId;
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function cleanMessageText(raw) {
    return String(raw || "")
      .replace(/\u200e|\u200f|\ufeff/g, "")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return true; // keep blank lines for readable outbound
        // Timestamps / delivery-only rows
        if (/^\d{1,2}:\d{2}(\s?[ap]\.?\s?m\.?)?$/i.test(trimmed)) return false;
        if (/^[✓✔]+$/.test(trimmed)) return false;
        return true;
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function extractTextFromNode(node) {
    if (!node) return "";
    const preferred =
      node.querySelector?.("span.selectable-text.copyable-text") ||
      node.querySelector?.("span.selectable-text") ||
      node.querySelector?.('[data-testid="msg-text"]') ||
      node.querySelector?.('span[dir="ltr"]') ||
      node.querySelector?.('span[dir="rtl"]');
    return cleanMessageText(
      (preferred?.innerText || node.innerText || node.textContent || ""),
    );
  }

  function isOutgoingRow(row) {
    if (!row) return false;
    const className = String(row.className || "");
    const dataId = row.getAttribute?.("data-id") || "";
    if (className.includes("message-out")) return true;
    if (dataId.startsWith("true_")) return true;
    if (row.closest?.(".message-out")) return true;
    return false;
  }

  function isIncomingRow(row) {
    if (!row || isOutgoingRow(row)) return false;
    const className = String(row.className || "");
    const dataId = row.getAttribute?.("data-id") || "";
    if (className.includes("message-in") || row.closest?.(".message-in")) {
      return true;
    }
    if (dataId.startsWith("false_")) return true;
    // Class-drift fallback: msg-container that is not inside an outgoing bubble.
    if (
      (row.getAttribute?.("data-testid") === "msg-container" ||
        row.querySelector?.('[data-testid="msg-container"]')) &&
      !row.closest?.(".message-out")
    ) {
      // Prefer left/incoming layout when class markers vanished.
      return !className.includes("message-out");
    }
    return false;
  }

  function getThreadId() {
    const selected =
      document.querySelector('[aria-selected="true"][data-id]') ||
      document.querySelector(
        '[data-testid="cell-frame-container"][aria-selected="true"]',
      ) ||
      document.querySelector('[aria-selected="true"]');
    const selectedId = selected?.getAttribute("data-id");

    const header =
      document.querySelector('[data-testid="conversation-header"]') ||
      document.querySelector("#main header") ||
      document.querySelector("header");
    const titled =
      header?.querySelector?.("[title]") ||
      document.querySelector("#main header [title]");
    const headerTitle =
      titled?.getAttribute("title") ||
      header?.getAttribute("title") ||
      "";
    const headerText = cleanMessageText(
      headerTitle ||
        header?.querySelector?.("span[dir]")?.textContent ||
        header?.textContent ||
        "",
    );

    const label = selectedId || headerTitle || headerText;
    if (!label) return null;
    // Require an open conversation pane, not only the chat list.
    const conversationOpen = Boolean(
      document.querySelector("#main") ||
        document.querySelector('[data-testid="conversation-panel-messages"]') ||
        document.querySelector('[data-testid="msg-container"]'),
    );
    if (!conversationOpen && !selectedId) return null;
    return `wa:${stableHash(label)}`;
  }

  function collectMessageRows() {
    const rows = new Set();
    for (const sel of [
      ".message-in",
      ".message-out",
      '[data-testid="msg-container"]',
      '[data-id^="false_"]',
      '[data-id^="true_"]',
      '#main div[data-id]',
      '[data-testid="conversation-panel-messages"] div[data-id]',
    ]) {
      document.querySelectorAll(sel).forEach((el) => {
        const row =
          el.closest?.(".message-in, .message-out, [data-id]") || el;
        rows.add(row);
      });
    }
    return [...rows];
  }

  function readLatestGuestMessage() {
    const rows = collectMessageRows();
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (!isIncomingRow(row)) continue;
      const text = extractTextFromNode(row);
      if (!text || text.length < 1) continue;

      const container =
        row.closest?.("[data-id]") ||
        row.querySelector?.("[data-id]") ||
        row;
      const providerId =
        container.getAttribute?.("data-id") ||
        row.getAttribute?.("data-id") ||
        row.getAttribute?.("data-pre-plain-text") ||
        // Never include row index — DOM order shifts when outbound bubbles appear
        // and would mint a new fingerprint for the same guest text (duplicate turns).
        `${getThreadId() || "unknown"}:${text}`;

      return {
        text: text.slice(0, 4000),
        externalMessageId: `wa:${stableHash(providerId)}`,
        guestLabel: null,
      };
    }
    return null;
  }

  function getComposer() {
    // Never use bare [contenteditable] — can hit search / other boxes and stack text.
    return (
      document.querySelector(
        '#main footer [contenteditable="true"][data-tab="10"]',
      ) ||
      document.querySelector(
        '#main footer [contenteditable="true"][role="textbox"]',
      ) ||
      document.querySelector(
        'footer [contenteditable="true"][data-tab="10"]',
      ) ||
      document.querySelector(
        '[data-testid="conversation-compose-box-input"] [contenteditable="true"]',
      ) ||
      document.querySelector('#main footer [contenteditable="true"]') ||
      document.querySelector('footer [contenteditable="true"][role="textbox"]')
    );
  }

  function getSendButton() {
    const footer =
      document.querySelector("#main footer") ||
      document.querySelector("footer") ||
      document.querySelector('[data-testid="conversation-compose-box-input"]')
        ?.closest("footer") ||
      document.body;
    const candidates = [
      footer.querySelector?.('button[data-testid="compose-btn-send"]'),
      footer.querySelector?.('button[data-testid="send"]'),
      footer.querySelector?.('div[data-testid="compose-btn-send"]'),
      footer.querySelector?.('span[data-icon="send"]')?.closest("button"),
      footer.querySelector?.('span[data-icon="send"]')?.closest('[role="button"]'),
      footer
        .querySelector?.('span[data-icon="wds-ic-send-filled"]')
        ?.closest("button"),
      footer
        .querySelector?.('span[data-icon="wds-ic-send-filled"]')
        ?.closest('[role="button"]'),
      footer.querySelector?.('span[data-icon="wds-ic-send"]')?.closest("button"),
      footer
        .querySelector?.('span[data-icon="wds-ic-send"]')
        ?.closest('[role="button"]'),
      footer.querySelector?.('button[aria-label*="Send"]'),
      footer.querySelector?.('button[aria-label*="Enviar"]'),
      footer.querySelector?.('[role="button"][aria-label*="Send"]'),
      footer.querySelector?.('[role="button"][aria-label*="Enviar"]'),
      document.querySelector('button[data-testid="compose-btn-send"]'),
      document.querySelector('button[aria-label*="Enviar"]'),
      document.querySelector('span[data-icon="send"]')?.closest("button"),
      document
        .querySelector('span[data-icon="send"]')
        ?.closest('[role="button"]'),
    ];
    for (const el of candidates) {
      if (el && !el.disabled) return el;
    }
    return null;
  }

  function readComposerText(editable) {
    return cleanMessageText(editable?.innerText || editable?.textContent || "");
  }

  /**
   * Collapse N glued OR separated copies into one canonical unit.
   * Handles: AAAA | A A A | A\nA\nA | A\n\nA\n\nA (menus).
   * Prefers the SHORTEST repeating unit so half-blobs are not returned.
   */
  function collapseRepeatedText(value) {
    const text = cleanMessageText(value);
    if (!text) return "";

    const separators = ["\n\n", "\n", " "];
    for (const sep of separators) {
      const parts = text
        .split(sep)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2 && parts.every((p) => p === parts[0])) {
        return parts[0];
      }
    }

    // Exact glued repeats — shortest unit first.
    const maxLen = Math.floor(text.length / 2);
    let best = null;
    for (let len = 6; len <= maxLen; len += 1) {
      if (text.length % len !== 0) continue;
      const chunk = text.slice(0, len);
      const times = text.length / len;
      if (times >= 2 && chunk.repeat(times) === text) {
        if (!best || chunk.length < best.length) best = chunk;
      }
    }
    if (best) return best;

    // Separated repeats — shortest unit wins (descending returned half-blobs).
    for (let len = 6; len <= maxLen; len += 1) {
      const unit = text.slice(0, len);
      for (const sep of ["", "\n", "\n\n", " "]) {
        for (let n = 2; n <= 8; n += 1) {
          if (Array(n).fill(unit).join(sep) === text) {
            if (!best || unit.length < best.length) best = unit;
          }
        }
      }
    }
    if (best) return best;

    // First sentence ending in ? / ! / . repeated.
    const firstEnd = (() => {
      const q = text.search(/[?!]/);
      const d = text.indexOf(".");
      const candidates = [q, d].filter((i) => i >= 6);
      if (!candidates.length) return -1;
      return Math.min(...candidates);
    })();
    if (firstEnd >= 6) {
      const unit = text.slice(0, firstEnd + 1).trim();
      if (unit.length >= 6) {
        for (const sep of ["", "\n", " ", "\n\n"]) {
          for (let n = 2; n <= 8; n += 1) {
            if (Array(n).fill(unit).join(sep) === text) return unit;
          }
        }
        if (text.startsWith(unit) && text.length >= unit.length * 2) {
          const rest = text.slice(unit.length).replace(/^[\s\n]+/, "");
          if (rest.startsWith(unit)) return unit;
        }
      }
    }

    return text;
  }

  function stripWaMarkdown(value) {
    return String(value || "").replace(/\*([^*]+)\*/g, "$1");
  }

  function normalizeForCompare(value) {
    return stripWaMarkdown(cleanMessageText(value))
      .replace(/\s+/g, " ")
      .trim();
  }

  function countNeedleOccurrences(visible, canonical) {
    const v = normalizeForCompare(visible);
    const c = normalizeForCompare(canonical);
    if (!c || c.length < 8) return v === c ? 1 : 0;
    const needle = c.slice(0, Math.min(48, c.length));
    let count = 0;
    let idx = 0;
    while (needle && (idx = v.indexOf(needle, idx)) !== -1) {
      count += 1;
      idx += Math.max(1, needle.length);
    }
    return count;
  }

  /**
   * True only when composer holds exactly ONE copy of canonical.
   * Rejects Lexical multi-write stacks (often 3× with mixed bold/plain).
   */
  function composerIsSingleCanonical(visible, canonical) {
    const vRaw = cleanMessageText(visible);
    const cRaw = cleanMessageText(canonical);
    if (!cRaw || !vRaw) return false;
    const occurrences = countNeedleOccurrences(vRaw, cRaw);
    if (occurrences !== 1) return false;
    const v = normalizeForCompare(vRaw);
    const c = normalizeForCompare(cRaw);
    if (v === c) return true;
    if (v.length > c.length * 1.15) return false;
    if (v.startsWith(c) && v.length <= c.length + 8) return true;
    const collapsed = normalizeForCompare(collapseRepeatedText(vRaw));
    return collapsed === c;
  }

  function clearComposer(editable) {
    if (!editable) return;
    editable.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editable);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
    try {
      document.execCommand("selectAll", false);
      document.execCommand("delete", false);
    } catch (_) {}
    try {
      editable.textContent = "";
      editable.innerHTML = "";
    } catch (_) {}
    try {
      editable.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "deleteContentBackward",
          data: null,
        }),
      );
    } catch (_) {}
  }

  /**
   * ONE clear + ONE insertText. Never stack 2nd/3rd writes (root cause of 3× bubbles).
   */
  function replaceComposerText(editable, rawText) {
    const canonical =
      collapseRepeatedText(stripWaMarkdown(rawText)) ||
      cleanMessageText(stripWaMarkdown(rawText));
    if (!editable || !canonical) return "";

    clearComposer(editable);
    editable.focus();
    try {
      document.execCommand("insertText", false, canonical);
    } catch (_) {
      return "";
    }

    const visible = readComposerText(editable);
    if (
      composerIsSingleCanonical(visible, canonical) &&
      countNeedleOccurrences(visible, canonical) === 1
    ) {
      return canonical;
    }
    clearComposer(editable);
    return "";
  }

  async function clickSend(editable) {
    let send = getSendButton();
    for (let i = 0; i < 16 && !send; i += 1) {
      await new Promise((r) => setTimeout(r, 60));
      send = getSendButton();
    }
    if (send) {
      send.focus?.();
      send.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      send.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
      send.click();
      return { clicked: true, enterFallback: false, button: send };
    }
    const opts = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    };
    editable.focus();
    editable.dispatchEvent(new KeyboardEvent("keydown", opts));
    editable.dispatchEvent(new KeyboardEvent("keypress", opts));
    editable.dispatchEvent(new KeyboardEvent("keyup", opts));
    return { clicked: false, enterFallback: true, button: null };
  }

  let sendMutex = Promise.resolve();

  /**
   * Single authorized outbound: 1 write → verify 1× → 1 Send. No stacked rewrites.
   */
  async function trySend(rawText, options = {}) {
    const run = async () => {
      const allowDispatch = options.allowDispatch !== false;
      const canonical =
        collapseRepeatedText(stripWaMarkdown(rawText)) ||
        cleanMessageText(stripWaMarkdown(rawText));
      const trace = {
        at: new Date().toISOString(),
        textPreview: String(canonical || "").slice(0, 120),
        contentBuild: CONTENT_BUILD,
        composerFound: false,
        composerFilled: false,
        sendButtonFound: false,
        clickExecuted: false,
        enterFallback: false,
        dispatchSkipped: false,
        verifiedInChat: false,
        writeCount: 0,
        needleCount: 0,
        collapsedRepeat:
          canonical !== cleanMessageText(stripWaMarkdown(rawText)),
        abortedMonster: false,
        error: null,
      };

      const editable = getComposer();
      if (!editable || !canonical) {
        trace.error = editable ? "empty_text" : "composer_not_found";
        await window.PragmaConcierge.storageLocalSet({
          conciergeLastOutbound: trace,
        });
        return { ok: false, trace };
      }
      trace.composerFound = true;

      const sendText = replaceComposerText(editable, canonical);
      trace.writeCount = 1;
      await new Promise((r) => setTimeout(r, 100));

      const visible = readComposerText(editable);
      trace.needleCount = countNeedleOccurrences(visible, canonical);

      if (
        !sendText ||
        !composerIsSingleCanonical(visible, canonical) ||
        trace.needleCount !== 1
      ) {
        clearComposer(editable);
        trace.abortedMonster = true;
        trace.composerFilled = false;
        trace.error = "composer_not_single_aborted";
        await window.PragmaConcierge.storageLocalSet({
          conciergeLastOutbound: trace,
        });
        return { ok: false, trace };
      }

      trace.composerFilled = true;
      trace.textPreview = String(canonical).slice(0, 120);

      if (!allowDispatch) {
        trace.dispatchSkipped = true;
        const verified = await waitForOutgoing(canonical, 800);
        trace.verifiedInChat = verified;
        trace.error = verified ? null : "dispatch_already_consumed";
        await window.PragmaConcierge.storageLocalSet({
          conciergeLastOutbound: trace,
        });
        return { ok: verified, trace };
      }

      const preClick = readComposerText(editable);
      if (
        !composerIsSingleCanonical(preClick, canonical) ||
        countNeedleOccurrences(preClick, canonical) !== 1
      ) {
        clearComposer(editable);
        trace.abortedMonster = true;
        trace.error = "composer_mutated_pre_click";
        await window.PragmaConcierge.storageLocalSet({
          conciergeLastOutbound: trace,
        });
        return { ok: false, trace };
      }

      const dispatch = await clickSend(editable);
      trace.sendButtonFound = Boolean(dispatch.button);
      trace.clickExecuted = Boolean(dispatch.clicked);
      trace.enterFallback = Boolean(dispatch.enterFallback);

      await new Promise((r) => setTimeout(r, 280));
      const stillThere = readComposerText(editable);
      if (
        stillThere &&
        composerIsSingleCanonical(stillThere, canonical) &&
        countNeedleOccurrences(stillThere, canonical) === 1
      ) {
        const again = await clickSend(editable);
        if (again.clicked) trace.clickExecuted = true;
        if (again.enterFallback) trace.enterFallback = true;
      } else if (stillThere && countNeedleOccurrences(stillThere, canonical) > 1) {
        clearComposer(editable);
        trace.abortedMonster = true;
        trace.error = "composer_duplicated_after_click";
      }

      const verified = await waitForOutgoing(canonical, 3500);
      trace.verifiedInChat = verified;
      const dispatched = trace.clickExecuted || trace.enterFallback;
      if (trace.abortedMonster) {
        // keep error
      } else if (!verified && !dispatched) {
        trace.error = "no_send_control";
      } else {
        trace.error = null;
      }
      await window.PragmaConcierge.storageLocalSet({
        conciergeLastOutbound: trace,
      });
      return { ok: (verified || dispatched) && !trace.abortedMonster, trace };
    };

    const next = sendMutex.then(run, run);
    sendMutex = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  function outgoingContains(text) {
    const needle = cleanMessageText(text).slice(0, 48);
    if (!needle) return false;
    const nodes = [
      ...document.querySelectorAll(
        '.message-out, [data-id^="true_"], [data-testid="msg-container"]',
      ),
    ];
    for (let i = nodes.length - 1; i >= Math.max(0, nodes.length - 12); i -= 1) {
      const row = nodes[i];
      if (isOutgoingRow(row) || row.classList?.contains("message-out")) {
        const body = extractTextFromNode(row);
        if (body.includes(needle)) return true;
      }
    }
    return false;
  }

  async function waitForOutgoing(text, timeoutMs) {
    const started = Date.now();
    const needle = collapseRepeatedText(text);
    while (Date.now() - started < timeoutMs) {
      if (outgoingContains(needle)) return true;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return outgoingContains(needle);
  }

  async function ensureLeader() {
    // Always take the lease on this WA tab. Background tabs must still answer;
    // server idempotency prevents double-send if two tabs race briefly.
    if (leader?.isLeader) {
      // Renew is handled by startLeaderRenew; keep reference warm.
      return true;
    }

    if (typeof window.PragmaConcierge.forceTabLeadership === "function") {
      leader = await window.PragmaConcierge.forceTabLeadership("whatsapp");
      failedLeaderTicks = 0;
      return Boolean(leader?.isLeader);
    }

    leader = await window.PragmaConcierge.claimTabLeadership("whatsapp");
    if (leader.isLeader) {
      failedLeaderTicks = 0;
      return true;
    }
    failedLeaderTicks += 1;
    return false;
  }

  function isUnreadBadge(el) {
    if (!el) return false;
    if (
      el.getAttribute?.("data-testid") === "icon-unread-count" ||
      el.closest?.('[data-testid="icon-unread-count"]')
    ) {
      return true;
    }
    const label = String(
      el.getAttribute?.("aria-label") || el.getAttribute?.("title") || "",
    ).toLowerCase();
    if (
      /unread|no le[ií]d|mensaje(?:s)? no le[ií]d|ungelesen|non lu/i.test(
        label,
      )
    ) {
      return true;
    }
    // Green unread count pill in chat list (e.g. "2")
    const text = String(el.textContent || "").trim();
    if (/^\d{1,3}$/.test(text) && Number(text) > 0) {
      const style = window.getComputedStyle?.(el);
      const bg = style?.backgroundColor || "";
      // Heuristic: WA unread pills are green / teal; skip grey mute badges.
      if (
        /rgb\(\s*(0|1[0-9]|2[0-5])\s*,\s*(1[2-9]\d|2[0-5]\d)\s*,/.test(bg) ||
        el.closest?.('[data-testid="icon-unread-count"]') ||
        el.getAttribute?.("data-testid") === "icon-unread-count"
      ) {
        return true;
      }
      // Numeric sibling inside a list cell is usually unread when not muted.
      const cell =
        el.closest?.('[data-testid="cell-frame-container"]') ||
        el.closest?.('[role="listitem"]');
      if (cell && !cell.querySelector?.('[data-testid="muted"]')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find a chat-list row with unread that is NOT the currently selected chat.
   * Root cause for "otro número no responde": tick stayed on the open chat and
   * never switched to the unread conversation from the second phone.
   */
  function findUnreadChatCell({ excludeSelected = true } = {}) {
    const unreadSelectors = [
      '[data-testid="icon-unread-count"]',
      '[aria-label*="unread message"]',
      '[aria-label*="Unread"]',
      '[aria-label*="unread messages"]',
      '[aria-label*="mensaje no leído"]',
      '[aria-label*="mensajes no leídos"]',
      '[aria-label*="no leído"]',
      '[aria-label*="no leídos"]',
      'span[aria-label*="unread"]',
      'div[aria-label*="unread"]',
      'span[aria-label*="no leíd"]',
      'div[aria-label*="no leíd"]',
    ];

    const badges = [];
    for (const selector of unreadSelectors) {
      document.querySelectorAll(selector).forEach((el) => badges.push(el));
    }
    document
      .querySelectorAll(
        '[data-testid="cell-frame-container"] span, [role="listitem"] span',
      )
      .forEach((el) => {
        if (isUnreadBadge(el)) badges.push(el);
      });

    for (const badge of badges) {
      if (!isUnreadBadge(badge)) continue;
      const cell =
        badge.closest('[data-testid="cell-frame-container"]') ||
        badge.closest('[role="listitem"]') ||
        badge.closest('div[tabindex="-1"]') ||
        badge.closest('div[tabindex="0"]') ||
        badge.closest("div[data-id]");
      if (!cell) continue;
      if (
        excludeSelected &&
        (cell.getAttribute("aria-selected") === "true" ||
          cell.getAttribute("aria-current") === "page" ||
          cell.matches?.('[aria-selected="true"]'))
      ) {
        continue;
      }
      return cell;
    }
    return null;
  }

  /**
   * Open first unread chat so autonomous replies work for a second phone
   * without the operator manually selecting that conversation.
   */
  function openFirstUnreadChat({ excludeSelected = true } = {}) {
    const now = Date.now();
    if (now - lastUnreadOpenAt < UNREAD_OPEN_COOLDOWN_MS) return false;

    const cell = findUnreadChatCell({ excludeSelected });
    // Only open chats that show an unread indicator — never click a random row.
    if (!cell) return false;

    lastUnreadOpenAt = now;
    try {
      cell.scrollIntoView?.({ block: "nearest" });
      cell.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      cell.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
      cell.click();
      return true;
    } catch (_) {
      return false;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function detectSessionState() {
    const text = String(document.body?.innerText || "").slice(0, 4000);
    const needs_auth = /Scan this QR code|Escanea el c[oó]digo QR|Link with phone number|Vincula tu tel[eé]fono|Log in to WhatsApp Web|Inicia sesi[oó]n en WhatsApp Web/i.test(
      text,
    );
    const phone_disconnected = /Phone not connected|Tel[eé]fono no conectado|computer is no longer connected|este equipo ya no est[aá] conectado/i.test(
      text,
    );
    const hasChats = Boolean(
      document.querySelector("#pane-side, [data-testid='chat-list'], [aria-label='Lista de chats']"),
    );
    return { needs_auth, phone_disconnected, hasChats };
  }

  async function setTurnLock(inFlight) {
    try {
      await window.PragmaConcierge.sendToBackground("CONCIERGE_TURN_LOCK", {
        inFlight: Boolean(inFlight),
      });
      await window.PragmaConcierge.storageLocalSet({
        conciergeTurnInFlight: Boolean(inFlight),
        conciergeTurnInFlightAt: inFlight ? Date.now() : null,
      });
    } catch (_) {}
  }

  async function loadOutboundQueue() {
    const stored = await window.PragmaConcierge.storageLocalGet(
      OUTBOUND_QUEUE_KEY,
    );
    return Array.isArray(stored[OUTBOUND_QUEUE_KEY])
      ? stored[OUTBOUND_QUEUE_KEY]
      : [];
  }

  async function saveOutboundQueue(queue) {
    await window.PragmaConcierge.storageLocalSet({
      [OUTBOUND_QUEUE_KEY]: queue,
    });
  }

  async function enqueueOutbound(item) {
    const queue = await loadOutboundQueue();
    if (queue.some((row) => row.fingerprint === item.fingerprint)) return;
    queue.push({
      ...item,
      enqueuedAt: Date.now(),
      attempts: 0,
    });
    await saveOutboundQueue(queue);
  }

  async function dequeueOutbound(fingerprint) {
    const queue = await loadOutboundQueue();
    await saveOutboundQueue(
      queue.filter((row) => row.fingerprint !== fingerprint),
    );
  }

  async function drainOutboundQueue(session) {
    if (session?.needs_auth || session?.phone_disconnected) return;
    if (!navigator.onLine) return;
    const queue = await loadOutboundQueue();
    if (!queue.length) return;
    const next = queue[0];
    if (!next?.text || !next?.threadId || !next?.fingerprint) {
      await saveOutboundQueue(queue.slice(1));
      return;
    }
    if (outboundDispatchFingerprints.has(next.fingerprint)) {
      await dequeueOutbound(next.fingerprint);
      return;
    }
    const threadNow = getThreadId();
    if (threadNow && threadNow !== next.threadId) {
      // Wait until the bound chat is open again; do not send cross-thread.
      return;
    }
    await setTurnLock(true);
    try {
      const result = await trySend(next.text, { allowDispatch: true });
      const dispatched =
        Boolean(result.trace?.clickExecuted) ||
        Boolean(result.trace?.enterFallback);
      if (dispatched || result.ok) {
        outboundDispatchFingerprints.add(next.fingerprint);
        lastOutboundText = collapseRepeatedText(next.text);
        await dequeueOutbound(next.fingerprint);
        await reportStatus({
          connected: true,
          role: "leader",
          sent: Boolean(result.ok || dispatched),
          mayAutoSend: true,
          threadId: next.threadId,
          queueDrain: true,
          outboundDispatched: true,
          suggestedPreview: String(next.text).slice(0, 120),
        });
        return;
      }
      next.attempts = Number(next.attempts || 0) + 1;
      if (next.attempts >= MAX_OUTBOUND_ATTEMPTS) {
        await dequeueOutbound(next.fingerprint);
        await reportStatus({
          connected: true,
          role: "leader",
          sent: false,
          error: "outbound_queue_exhausted",
          threadId: next.threadId,
        });
        return;
      }
      const rest = await loadOutboundQueue();
      const idx = rest.findIndex((row) => row.fingerprint === next.fingerprint);
      if (idx >= 0) {
        rest[idx] = next;
        await saveOutboundQueue(rest);
      }
    } finally {
      await setTurnLock(false);
    }
  }

  async function reportStatus(payload) {
    const session = detectSessionState();
    const network_down = !navigator.onLine;
    const hardStop = session.needs_auth || session.phone_disconnected || network_down;
    await window.PragmaConcierge.sendToBackground("CONCIERGE_CHANNEL_STATUS", {
      channel: platform,
      contentBuild: CONTENT_BUILD,
      tabVisible: document.visibilityState === "visible",
      tabAlive: true,
      tabAliveAt: new Date().toISOString(),
      needs_auth: session.needs_auth,
      phone_disconnected: session.phone_disconnected,
      network_down,
      hasChats: session.hasChats,
      ...payload,
      connected: hardStop ? false : payload.connected !== false,
    });
  }

  async function tick() {
    if (tickInFlight) return;
    tickInFlight = true;
    try {
      const session = detectSessionState();
      if (session.needs_auth || session.phone_disconnected) {
        await reportStatus({
          connected: false,
          role: "leader",
          needs_auth: session.needs_auth,
          phone_disconnected: session.phone_disconnected,
          error: session.needs_auth ? "needs_auth" : "phone_disconnected",
        });
        return;
      }
      if (!navigator.onLine) {
        await reportStatus({
          connected: false,
          role: "leader",
          network_down: true,
          error: "network_down",
        });
        return;
      }

      if (!(await ensureLeader())) {
        // Only non-leaders report thin presence (do not wipe leader fields).
        await reportStatus({
          connected: true,
          role: "presence",
        });
        return;
      }

      await drainOutboundQueue(session);

      // Prefer ANY other unread chat before processing the currently open one.
      // Without this, a second phone's message never gets a turn while chat A is open.
      let switchedUnread = false;
      if (findUnreadChatCell({ excludeSelected: true })) {
        switchedUnread = openFirstUnreadChat({ excludeSelected: true });
        if (switchedUnread) {
          await sleep(1000);
        }
      }

      let threadId = getThreadId();
      let message = readLatestGuestMessage();

      // Autonomous: if no open chat / no guest text, open an unread conversation
      // (including the currently selected row if it still shows unread).
      if (!threadId || !message?.text) {
        const opened = openFirstUnreadChat({ excludeSelected: false });
        if (opened) {
          await sleep(1000);
          threadId = getThreadId();
          message = readLatestGuestMessage();
        }
      }

      if (!threadId || !message?.text) {
        await reportStatus({
          connected: true,
          role: "leader",
          threadId: threadId || null,
          hasGuestMessage: false,
          switchedUnread,
          contentBuild: CONTENT_BUILD,
        });
        return;
      }

      noteThreadChange(threadId);
      turnBoundThreadId = threadId;

      // Ignore our own outbound if WA DOM briefly classifies it as inbound.
      if (lastOutboundText) {
        const guest = cleanMessageText(message.text);
        const mine = cleanMessageText(lastOutboundText);
        if (
          guest === mine ||
          guest.startsWith(mine.slice(0, Math.min(48, mine.length))) ||
          mine.startsWith(guest.slice(0, Math.min(48, guest.length)))
        ) {
          return;
        }
      }

      const textFingerprint = `${threadId}::text:${stableHash(message.text)}`;
      // Prefer provider id when stable; text fingerprint is TTL-scoped for retests.
      const fingerprint = message.externalMessageId
        ? `${threadId}::${message.externalMessageId}`
        : textFingerprint;
      const providerFingerprint = `${threadId}::${message.externalMessageId}`;
      const nowFp = Date.now();
      const textFresh =
        !lastTextFingerprint ||
        lastTextFingerprint !== textFingerprint ||
        nowFp - lastTextFingerprintAt > FINGERPRINT_TTL_MS;
      const fpFresh =
        !lastFingerprint ||
        lastFingerprint !== fingerprint ||
        nowFp - lastFingerprintAt > FINGERPRINT_TTL_MS;
      // Already fully handled inside TTL — still try other unread chats next tick.
      if (!fpFresh || (!textFresh && fingerprint === textFingerprint)) {
        if (findUnreadChatCell({ excludeSelected: true })) {
          openFirstUnreadChat({ excludeSelected: true });
        }
        return;
      }
      if (
        processingFingerprints.has(fingerprint) ||
        processingFingerprints.has(textFingerprint) ||
        processingFingerprints.has(providerFingerprint)
      ) {
        return;
      }

      // Reserve BEFORE any await so a concurrent observer tick cannot start a
      // second ingest/turn for the same guest message (root cause of multi-turn).
      processingFingerprints.add(fingerprint);
      processingFingerprints.add(textFingerprint);
      processingFingerprints.add(providerFingerprint);

      await reportStatus({
        connected: true,
        role: "leader",
        threadId,
        hasGuestMessage: true,
      });

      const ingest = await window.PragmaConcierge.sendToBackground(
        "CONCIERGE_INGEST",
        {
          channel: platform,
          threadId,
          guestMessage: message.text,
          externalMessageId: message.externalMessageId,
          platformDetected: platform,
        },
      );
      if (!ingest?.ok) {
        processingFingerprints.delete(fingerprint);
        processingFingerprints.delete(textFingerprint);
        processingFingerprints.delete(providerFingerprint);
        // Keep channel Online while the tab is alive; surface the error for the panel.
        await reportStatus({
          connected: true,
          role: "leader",
          threadId,
          error: ingest?.data?.error || `HTTP ${ingest?.status || 0}`,
        });
        return;
      }

      const turn = await window.PragmaConcierge.sendToBackground(
        "CONCIERGE_TURN",
        {
          channel: platform,
          threadId,
          guestMessage: message.text,
          externalMessageId: message.externalMessageId,
        },
      );
      if (!turn?.ok) {
        processingFingerprints.delete(fingerprint);
        processingFingerprints.delete(textFingerprint);
        processingFingerprints.delete(providerFingerprint);
        await reportStatus({
          connected: true,
          role: "leader",
          threadId,
          error: turn?.data?.error || `HTTP ${turn?.status || 0}`,
        });
        return;
      }

      connected = true;

      // Backend idempotency claim: same externalMessageId / thread+text must never send again.
      if (turn?.data?.duplicate) {
        lastFingerprint = fingerprint;
        lastFingerprintAt = Date.now();
        lastTextFingerprint = textFingerprint;
        lastTextFingerprintAt = Date.now();
        await reportStatus({
          connected: true,
          role: "leader",
          sent: false,
          mayAutoSend: false,
          duplicate: true,
          threadId,
          lastMessageAt: new Date().toISOString(),
        });
        return;
      }

      const suggested = turn?.data?.suggestedReply || null;
      let sent = false;
      let outboundTrace = null;
      const shouldAutoSend = Boolean(turn?.data?.mayAutoSend && suggested);

      // Consume guest message immediately after a successful turn so MutationObserver
      // / polling cannot re-enter ingest+turn for the same message.
      lastFingerprint = fingerprint;
      lastFingerprintAt = Date.now();
      lastTextFingerprint = textFingerprint;
      lastTextFingerprintAt = Date.now();

      if (shouldAutoSend) {
        // Short natural pause — long delays invited observer re-entry / stacked drafts.
        const delayMs = Math.min(
          1_400,
          Math.max(
            400,
            Number(turn?.data?.naturalDelayMs)
              ? Math.min(Number(turn.data.naturalDelayMs), 1400)
              : Math.round(String(suggested).length * 12),
          ),
        );
        await sleep(delayMs);

        // R5: never send a reply composed for chat A into chat B.
        const threadNow = getThreadId();
        if (
          !threadNow ||
          threadNow !== threadId ||
          (turnBoundThreadId && turnBoundThreadId !== threadNow)
        ) {
          outboundTrace = {
            error: "chat_switched_before_send",
            dropped: true,
            boundThreadId: threadId,
            activeThreadId: threadNow,
          };
          sent = false;
          await enqueueOutbound({
            fingerprint,
            threadId,
            text: suggested,
            reason: "chat_switched_before_send",
          });
        } else {
        await setTurnLock(true);
        try {
        const alreadyDispatched = outboundDispatchFingerprints.has(fingerprint);
        if (alreadyDispatched) {
          outboundTrace = (
            await trySend(suggested, { allowDispatch: false })
          ).trace;
          sent = Boolean(outboundTrace?.verifiedInChat);
        } else {
          const first = await trySend(suggested, { allowDispatch: true });
          outboundTrace = first.trace;
          const dispatched =
            Boolean(first.trace?.clickExecuted) ||
            Boolean(first.trace?.enterFallback);
          if (dispatched) {
            outboundDispatchFingerprints.add(fingerprint);
            lastOutboundText = collapseRepeatedText(suggested);
          }
          sent = Boolean(first.ok);
          // Retry Send click only — never a second full write (that stacks text).
          if (!sent && !dispatched) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            if (!outboundDispatchFingerprints.has(fingerprint)) {
              const editable = getComposer();
              if (editable) {
                const again = await clickSend(editable);
                outboundTrace = {
                  ...(first.trace || {}),
                  clickExecuted: Boolean(again.clicked),
                  enterFallback: Boolean(again.enterFallback),
                  retryClickOnly: true,
                };
                if (again.clicked || again.enterFallback) {
                  outboundDispatchFingerprints.add(fingerprint);
                  lastOutboundText = collapseRepeatedText(suggested);
                  sent = true;
                }
              }
            }
          }
        }
        if (!sent && !outboundDispatchFingerprints.has(fingerprint)) {
          await enqueueOutbound({
            fingerprint,
            threadId,
            text: suggested,
            reason: outboundTrace?.error || "send_failed",
          });
        }
        } finally {
          await setTurnLock(false);
        }
        }
      }

      await reportStatus({
        connected: true,
        role: "leader",
        sent,
        mayAutoSend: Boolean(turn?.data?.mayAutoSend),
        mode: turn?.data?.mode || null,
        threadId,
        lastMessageAt: new Date().toISOString(),
        lastIntent: turn?.data?.intent?.intent || null,
        suggestedPreview: suggested ? suggested.slice(0, 120) : null,
        outboundVerified: Boolean(outboundTrace?.verifiedInChat),
        outboundError: outboundTrace?.error || null,
        outboundDispatched: outboundDispatchFingerprints.has(fingerprint),
        error:
          shouldAutoSend &&
          outboundDispatchFingerprints.has(fingerprint) &&
          !sent
            ? outboundTrace?.error || "Envío despachado; verificación DOM pendiente"
            : shouldAutoSend && !outboundDispatchFingerprints.has(fingerprint)
              ? outboundTrace?.error || "No se encontró control de envío"
              : null,
      });
    } finally {
      tickInFlight = false;
    }
  }

  // Immediate presence + observer/polling from shared helper.
  reportStatus({ connected: true, role: "boot" }).catch(() => {});
  window.PragmaConcierge.watchConversation(() => {
    channelQueue(() =>
      tick().catch(async (error) => {
        connected = false;
        await reportStatus({
          connected: true,
          error: String(error),
        }).catch(() => {});
      }),
    );
  });
  // Kick once without waiting for the first mutation (QR → inbox transition).
  channelQueue(() => tick().catch(() => {}));

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CONCIERGE_PING") {
      const session = detectSessionState();
      sendResponse({
        ok: true,
        contentBuild: CONTENT_BUILD,
        needs_auth: session.needs_auth,
        phone_disconnected: session.phone_disconnected,
        network_down: !navigator.onLine,
        tabVisible: document.visibilityState === "visible",
      });
      return true;
    }
  });

  window.addEventListener("online", () => {
    channelQueue(() => tick().catch(() => {}));
  });

  // Recover after tab sleep / extension reload: clear in-memory locks and re-tick.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    processingFingerprints.clear();
    outboundDispatchFingerprints.clear();
    lastFingerprint = "";
    lastFingerprintAt = 0;
    lastTextFingerprint = "";
    lastTextFingerprintAt = 0;
    leader = null;
    channelQueue(() =>
      tick().catch(async (error) => {
        await reportStatus({
          connected: true,
          role: "leader",
          error: String(error),
          contentBuild: CONTENT_BUILD,
        }).catch(() => {});
      }),
    );
  });
})();
