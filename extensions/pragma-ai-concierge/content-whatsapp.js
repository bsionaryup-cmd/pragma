(() => {
  const platform = "whatsapp_web";
  /** Guest message fingerprint fully consumed (turn done; no further engine/send). */
  let lastFingerprint = "";
  /** Same-thread identical guest text already answered in this tab session. */
  let lastTextFingerprint = "";
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
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        // Timestamps / delivery-only rows
        if (/^\d{1,2}:\d{2}(\s?[ap]\.?\s?m\.?)?$/i.test(line)) return false;
        if (/^[✓✔]+$/.test(line)) return false;
        return true;
      })
      .join("\n")
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
    return (
      document.querySelector('[contenteditable="true"][data-tab="10"]') ||
      document.querySelector('#main footer [contenteditable="true"]') ||
      document.querySelector('footer [contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"]')
    );
  }

  function getSendButton() {
    return (
      document.querySelector('button[data-testid="compose-btn-send"]') ||
      document.querySelector('button[data-testid="send"]') ||
      document.querySelector('footer button[aria-label*="Send"]') ||
      document.querySelector('footer button[aria-label*="Enviar"]') ||
      document.querySelector('button[aria-label*="Send"]') ||
      document.querySelector('button[aria-label*="Enviar"]') ||
      document.querySelector('span[data-icon="send"]')?.closest("button") ||
      document
        .querySelector('span[data-icon="wds-ic-send-filled"]')
        ?.closest("button") ||
      document.querySelector('span[data-icon="wds-ic-send"]')?.closest("button")
    );
  }

  function composerHasText(editable, text) {
    const current = cleanMessageText(editable?.innerText || editable?.textContent || "");
    const needle = cleanMessageText(text).slice(0, 40);
    return Boolean(needle) && current.includes(needle);
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
    while (Date.now() - started < timeoutMs) {
      if (outgoingContains(text)) return true;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return outgoingContains(text);
  }

  /**
   * WhatsApp Web ignores naive text assignment unless the composer receives
   * insert/paste input events that update its internal React state.
   */
  async function fillComposer(text) {
    const editable = getComposer();
    if (!editable) {
      return { ok: false, error: "composer_not_found", editable: null };
    }
    editable.focus();
    document.execCommand("selectAll", false);
    document.execCommand("delete", false);

    // Strategy 1: execCommand insertText
    document.execCommand("insertText", false, text);
    editable.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text,
      }),
    );

    if (!composerHasText(editable, text)) {
      // Strategy 2: paste (WA often binds to paste)
      try {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        editable.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          }),
        );
      } catch (_) {
        // ClipboardEvent may be restricted; continue.
      }
    }

    if (!composerHasText(editable, text)) {
      // Strategy 3: beforeinput + text node
      editable.textContent = text;
      editable.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: text,
        }),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 180));
    if (!composerHasText(editable, text)) {
      return {
        ok: false,
        error: "composer_text_not_accepted",
        editable,
      };
    }
    return { ok: true, error: null, editable };
  }

  async function trySend(text, options = {}) {
    const allowDispatch = options.allowDispatch !== false;
    const trace = {
      at: new Date().toISOString(),
      textPreview: String(text || "").slice(0, 120),
      composerFound: false,
      composerFilled: false,
      sendButtonFound: false,
      clickExecuted: false,
      enterFallback: false,
      dispatchSkipped: false,
      verifiedInChat: false,
      error: null,
    };

    const filled = await fillComposer(text);
    trace.composerFound = Boolean(filled.editable);
    trace.composerFilled = Boolean(filled.ok);
    if (!filled.ok) {
      trace.error = filled.error;
      await chrome.storage.local.set({ conciergeLastOutbound: trace });
      return { ok: false, trace };
    }

    // Idempotency: never click/Enter twice for the same guest message.
    if (!allowDispatch) {
      trace.dispatchSkipped = true;
      const verified = await waitForOutgoing(text, 800);
      trace.verifiedInChat = verified;
      trace.error = verified ? null : "dispatch_already_consumed";
      await chrome.storage.local.set({ conciergeLastOutbound: trace });
      return { ok: verified, trace };
    }

    let send = getSendButton();
    // Wait briefly for WA to enable the send control after composer input.
    for (let i = 0; i < 8 && !send; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      send = getSendButton();
    }
    trace.sendButtonFound = Boolean(send);

    if (send) {
      send.click();
      trace.clickExecuted = true;
    } else {
      filled.editable.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      );
      trace.enterFallback = true;
    }

    const verified = await waitForOutgoing(text, 3500);
    trace.verifiedInChat = verified;
    if (!verified) {
      trace.error = send
        ? "send_click_without_outgoing_message"
        : "enter_without_outgoing_message";
    }
    await chrome.storage.local.set({ conciergeLastOutbound: trace });
    return { ok: verified, trace };
  }

  async function ensureLeader() {
    if (leader?.isLeader) return true;
    leader = await window.PragmaConcierge.claimTabLeadership("whatsapp");
    return leader.isLeader;
  }

  async function reportStatus(payload) {
    await window.PragmaConcierge.sendToBackground("CONCIERGE_CHANNEL_STATUS", {
      channel: platform,
      tabVisible: document.visibilityState === "visible",
      ...payload,
    });
  }

  async function tick() {
    if (tickInFlight) return;
    tickInFlight = true;
    try {
      // Presence is independent of leadership: any open WA tab keeps channel Online.
      await reportStatus({
        connected: true,
        role: "presence",
      });

      if (!(await ensureLeader())) return;

      const threadId = getThreadId();
      const message = readLatestGuestMessage();
      if (!threadId || !message?.text) {
        await reportStatus({
          connected: true,
          role: "leader",
          threadId: threadId || null,
          hasGuestMessage: false,
        });
        return;
      }

      const textFingerprint = `${threadId}::text:${stableHash(message.text)}`;
      // Prefer text fingerprint for local dedupe — WhatsApp data-id attributes drift.
      const fingerprint = textFingerprint;
      const providerFingerprint = `${threadId}::${message.externalMessageId}`;
      // Already fully handled — avoid thin status reports that wipe mayAutoSend/sent.
      if (
        fingerprint === lastFingerprint ||
        textFingerprint === lastTextFingerprint ||
        providerFingerprint === lastFingerprint
      ) {
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
        lastTextFingerprint = textFingerprint;
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
      lastTextFingerprint = textFingerprint;

      if (shouldAutoSend) {
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
            // Mark BEFORE any retry: real WA may have already delivered the SMS/chat
            // even when .message-out verification fails (root cause of flood).
            outboundDispatchFingerprints.add(fingerprint);
          }
          sent = Boolean(first.ok);
          // Same-tick retry ONLY if we never clicked/Entered (button missing).
          if (!sent && !dispatched) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            if (!outboundDispatchFingerprints.has(fingerprint)) {
              const retry = await trySend(suggested, { allowDispatch: true });
              outboundTrace = retry.trace;
              if (
                retry.trace?.clickExecuted ||
                retry.trace?.enterFallback
              ) {
                outboundDispatchFingerprints.add(fingerprint);
              }
              sent = Boolean(retry.ok);
            }
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
    tick().catch(async (error) => {
      connected = false;
      await reportStatus({
        connected: true,
        error: String(error),
      }).catch(() => {});
    });
  });
  // Kick once without waiting for the first mutation (QR → inbox transition).
  tick().catch(() => {});
})();
