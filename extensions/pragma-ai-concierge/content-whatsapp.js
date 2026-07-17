(() => {
  const platform = "whatsapp_web";
  let lastFingerprint = "";
  let leader = null;
  let connected = true;

  function getThreadId() {
    // WhatsApp Web suele reflejar el chat en el hash/path
    return location.href || "whatsapp-root";
  }

  function readLatestGuestMessage() {
    const nodes = [
      ...document.querySelectorAll(
        '[data-testid="msg-container"], .message-in, div.message-in, div[class*="message-in"]',
      ),
    ];
    // Preferir mensajes entrantes; si no hay marcador, usar el último
    const incoming = nodes.filter((n) =>
      /message-in|msg-container/i.test(n.className + (n.getAttribute("data-testid") || "")),
    );
    const last = (incoming.length ? incoming : nodes).at(-1);
    const text = (last?.innerText || "").trim();
    return text.slice(0, 4000);
  }

  function tryInsert(text) {
    const editable =
      document.querySelector('[contenteditable="true"][data-tab="10"]') ||
      document.querySelector('footer [contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"]');
    if (!editable) return false;
    editable.focus();
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, text);
    return true;
  }

  window.addEventListener("pragma-concierge-insert", (ev) => {
    tryInsert(ev.detail?.text || "");
  });

  async function ensureLeader() {
    if (leader?.isLeader) return true;
    leader = await window.PragmaConcierge.claimTabLeadership("whatsapp");
    return leader.isLeader;
  }

  async function tick() {
    if (!(await ensureLeader())) return;
    const guestMessage = readLatestGuestMessage();
    if (!guestMessage) return;
    const fingerprint = `${getThreadId()}::${guestMessage.slice(0, 160)}`;
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;

    const ingest = await window.PragmaConcierge.sendToBackground("CONCIERGE_INGEST", {
      channel: platform,
      threadId: getThreadId(),
      guestMessage,
      platformDetected: platform,
    });
    connected = Boolean(ingest?.ok);

    const turn = await window.PragmaConcierge.sendToBackground("CONCIERGE_TURN", {
      channel: platform,
      threadId: getThreadId(),
      guestMessage,
    });
    connected = connected && Boolean(turn?.ok);

    const suggested = turn?.data?.suggestedReply || null;
    window.PragmaConcierge.showConciergePanel(suggested, {
      ...(turn?.data || {}),
      connected,
    });

    if (turn?.data?.mayAutoSend && suggested) {
      tryInsert(suggested);
    }
  }

  window.PragmaConcierge.watchConversation(() => {
    tick().catch(() => {
      connected = false;
    });
  });
})();
