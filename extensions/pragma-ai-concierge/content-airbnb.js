(() => {
  const platform = "airbnb_web";
  let lastFingerprint = "";

  function getThreadId() {
    return location.pathname + location.search;
  }

  function readLatestGuestMessage() {
    const candidates = [
      ...document.querySelectorAll(
        '[data-testid*="message"], [class*="message"], li[role="listitem"]',
      ),
    ];
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const text = (candidates[i].innerText || "").trim();
      if (text.length > 8 && text.length < 4000) return text;
    }
    return "";
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
  }, 5000);
})();
