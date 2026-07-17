function detectPlatform() {
  const host = location.hostname;
  if (host.includes("whatsapp")) return "whatsapp_web";
  if (host.includes("airbnb")) return "airbnb_web";
  return "internal";
}

async function sendToBackground(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}

/**
 * Observa el DOM con MutationObserver + polling de respaldo (fail-closed).
 * Debounce evita tormentas de eventos.
 */
function watchConversation(onChange) {
  let timer = null;
  const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        onChange();
      } catch (_) {}
    }, 200);
  };

  const root = document.body || document.documentElement;
  const observer = new MutationObserver(notify);
  observer.observe(root, { childList: true, subtree: true, characterData: true });

  // Backup polling cada 3s — detección más inmediata sin depender solo de mutations
  const intervalId = setInterval(notify, 3000);

  window.addEventListener("online", notify);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") notify();
  });
  const onStorageChanged = (changes, areaName) => {
    if (areaName === "local" && changes.conciergeReconnectAt) notify();
  };
  chrome.storage.onChanged.addListener(onStorageChanged);

  // Fire once immediately so channel presence / open chat is not delayed 5–8s.
  notify();

  return () => {
    observer.disconnect();
    clearInterval(intervalId);
    clearTimeout(timer);
    chrome.storage.onChanged.removeListener(onStorageChanged);
  };
}

/** Leader election simple entre pestañas del mismo origen. */
async function claimTabLeadership(channelKey) {
  const tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const key = `concierge-leader:${channelKey}`;
  const now = Date.now();
  const current = await chrome.storage.local.get(key);
  const leader = current[key];
  if (leader && leader.expiresAt > now && leader.tabId !== tabId) {
    return { isLeader: false, tabId };
  }
  const payload = { tabId, expiresAt: now + 15_000 };
  await chrome.storage.local.set({ [key]: payload });
  const renew = setInterval(() => {
    chrome.storage.local.set({
      [key]: { tabId, expiresAt: Date.now() + 15_000 },
    });
  }, 5_000);
  return {
    isLeader: true,
    tabId,
    release: () => clearInterval(renew),
  };
}

window.PragmaConcierge = {
  detectPlatform,
  sendToBackground,
  watchConversation,
  claimTabLeadership,
};
