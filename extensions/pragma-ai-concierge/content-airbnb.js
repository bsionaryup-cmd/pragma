(() => {
  const platform = "airbnb_web";
  let lastFingerprint = "";
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
      .filter((line) => Boolean(line))
      .join("\n")
      .trim();
  }

  function getThreadId() {
    const value = location.pathname + location.search;
    if (/\/inbox|\/messaging|thread|conversation/i.test(value)) {
      return `airbnb:${stableHash(value)}`;
    }
    // Fallback: open thread panel markers
    const threadNode =
      document.querySelector('[data-testid*="thread"]') ||
      document.querySelector('[data-testid*="conversation"]');
    if (threadNode) {
      const key =
        threadNode.getAttribute("data-testid") ||
        threadNode.id ||
        threadNode.textContent?.slice(0, 80) ||
        value;
      return `airbnb:${stableHash(String(key))}`;
    }
    return null;
  }

  function isOutgoingNode(node) {
    const marker = [
      node.getAttribute("data-testid"),
      node.getAttribute("aria-label"),
      node.className,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return /(outgoing|sent|host-message|by-you|message-own|message-out)/.test(
      marker,
    );
  }

  function readLatestGuestMessage() {
    const candidates = [
      ...document.querySelectorAll(
        '[data-testid*="message"], li[role="listitem"], [data-testid*="chat-bubble"]',
      ),
    ];
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const node = candidates[i];
      if (isOutgoingNode(node)) continue;
      const text = cleanMessageText(node.innerText || "");
      if (text.length <= 1 || text.length >= 4000) continue;
      const providerId =
        node.getAttribute("data-message-id") ||
        node.getAttribute("data-id") ||
        node.id ||
        `${getThreadId() || "unknown"}:${text}:${i}`;
      return {
        text,
        externalMessageId: `airbnb:${stableHash(providerId)}`,
      };
    }
    return null;
  }

  function tryInsert(text) {
    const editable =
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector("textarea");
    if (!editable) return false;
    editable.focus();
    if (editable.tagName === "TEXTAREA") {
      editable.value = text;
      editable.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, text);
    return true;
  }

  async function trySend(text) {
    if (!tryInsert(text)) return false;
    await new Promise((resolve) => setTimeout(resolve, 220));
    const send =
      document.querySelector('button[data-testid*="send"]') ||
      document.querySelector('button[aria-label*="Send"]') ||
      document.querySelector('button[aria-label*="Enviar"]');
    if (send) {
      send.click();
      return true;
    }
    const editable =
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector("textarea");
    if (editable) {
      editable.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      );
      return true;
    }
    return false;
  }

  async function ensureLeader() {
    if (leader?.isLeader) return true;
    leader = await window.PragmaConcierge.claimTabLeadership("airbnb");
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
      // Presence independent of leadership (same root-cause fix as WhatsApp).
      await reportStatus({ connected: true, role: "presence" });
      if (!(await ensureLeader())) return;

      const threadId = getThreadId();
      const message = readLatestGuestMessage();
      await reportStatus({
        connected: true,
        role: "leader",
        threadId: threadId || null,
        hasGuestMessage: Boolean(message?.text),
      });
      if (!threadId || !message?.text) return;

      const fingerprint = `${threadId}::${message.externalMessageId}`;
      if (fingerprint === lastFingerprint) return;

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
        await reportStatus({
          connected: true,
          role: "leader",
          threadId,
          error: turn?.data?.error || `HTTP ${turn?.status || 0}`,
        });
        return;
      }

      lastFingerprint = fingerprint;
      connected = true;
      const suggested = turn?.data?.suggestedReply || null;
      let sent = false;
      if (turn?.data?.mayAutoSend && suggested) {
        sent = await trySend(suggested);
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
        error:
          turn?.data?.mayAutoSend && suggested && !sent
            ? "No se encontró el botón de envío"
            : null,
      });
    } finally {
      tickInFlight = false;
    }
  }

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
  tick().catch(() => {});
})();
