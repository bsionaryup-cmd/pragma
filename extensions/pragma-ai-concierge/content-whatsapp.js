(() => {
  const platform = "whatsapp_web";
  let lastFingerprint = "";

  function getThreadId() {
    return location.pathname || "whatsapp-root";
  }

  function readLatestGuestMessage() {
    const nodes = [
      ...document.querySelectorAll(
        '[data-testid="msg-container"], .message-in, div[class*="message-in"]',
      ),
    ];
    const last = nodes[nodes.length - 1];
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

  async function tick() {
    const guestMessage = readLatestGuestMessage();
    if (!guestMessage) return;
    const fingerprint = `${getThreadId()}::${guestMessage.slice(0, 120)}`;
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;

    await window.PragmaConcierge.sendToBackground("CONCIERGE_INGEST", {
      channel: platform,
      threadId: getThreadId(),
      guestMessage,
      platformDetected: platform,
    });

    const turn = await window.PragmaConcierge.sendToBackground("CONCIERGE_TURN", {
      channel: platform,
      threadId: getThreadId(),
      guestMessage,
    });

    const suggested = turn?.data?.suggestedReply || null;
    window.PragmaConcierge.showConciergePanel(suggested, turn?.data || {});

    if (turn?.data?.mayAutoSend && suggested) {
      tryInsert(suggested);
    }
  }

  setInterval(() => {
    tick().catch(() => undefined);
  }, 4000);
})();
