function detectPlatform() {
  const host = location.hostname;
  if (host.includes("whatsapp")) return "whatsapp_web";
  if (host.includes("airbnb")) return "airbnb_web";
  return "internal";
}

function showConciergePanel(text, meta = {}) {
  let panel = document.getElementById("pragma-concierge-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "pragma-concierge-panel";
    panel.style.cssText =
      "position:fixed;z-index:2147483647;right:16px;bottom:16px;width:360px;max-height:50vh;overflow:auto;background:#111;color:#f5f5f5;border:1px solid #333;border-radius:10px;padding:12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)";
    document.documentElement.appendChild(panel);
  }
  const mode = meta.mode || "manual";
  const connected = meta.connected === false ? "OFFLINE" : "ONLINE";
  const auto = meta.mayAutoSend ? "AUTO-SEND OK" : "HUMAN SEND";
  panel.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px">PRAGMA AI Concierge · ${mode} · ${connected} · ${auto}</div>
    <div style="white-space:pre-wrap;margin-bottom:10px">${escapeHtml(text || "(sin sugerencia)")}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="pragma-copy" style="flex:1;min-width:90px;padding:8px;border:0;border-radius:6px;cursor:pointer">Copiar</button>
      <button id="pragma-insert" style="flex:1;min-width:90px;padding:8px;border:0;border-radius:6px;cursor:pointer">Insertar</button>
      <button id="pragma-health" style="flex:1;min-width:90px;padding:8px;border:0;border-radius:6px;cursor:pointer">Health</button>
    </div>
    <div id="pragma-status" style="margin-top:8px;color:#9ca3af;font-size:11px"></div>
  `;
  panel.querySelector("#pragma-copy")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch (_) {}
  });
  panel.querySelector("#pragma-insert")?.addEventListener("click", () => {
    window.dispatchEvent(
      new CustomEvent("pragma-concierge-insert", { detail: { text } }),
    );
  });
  panel.querySelector("#pragma-health")?.addEventListener("click", async () => {
    const res = await sendToBackground("CONCIERGE_HEALTH", {});
    const el = panel.querySelector("#pragma-status");
    if (el) {
      el.textContent = res?.ok
        ? `API OK · sessions=${res.data?.sessions?.length ?? 0} · detRate=${(
            (res.data?.metrics?.deterministicRate || 0) * 100
          ).toFixed(0)}%`
        : `API FAIL · ${res?.data?.error || res?.status || "offline"}`;
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
    }, 350);
  };

  const root = document.body || document.documentElement;
  const observer = new MutationObserver(notify);
  observer.observe(root, { childList: true, subtree: true, characterData: true });

  // Backup polling cada 8s (antes 4s) — menor CPU si MutationObserver funciona
  const intervalId = setInterval(notify, 8000);

  window.addEventListener("online", notify);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") notify();
  });

  return () => {
    observer.disconnect();
    clearInterval(intervalId);
    clearTimeout(timer);
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
  showConciergePanel,
  sendToBackground,
  watchConversation,
  claimTabLeadership,
};
