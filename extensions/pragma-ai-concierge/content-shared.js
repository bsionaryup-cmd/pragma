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
  const auto = meta.mayAutoSend ? "AUTO-SEND OK" : "HUMAN SEND";
  panel.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px">PRAGMA AI Concierge · ${mode} · ${auto}</div>
    <div style="white-space:pre-wrap;margin-bottom:10px">${escapeHtml(text || "(sin sugerencia)")}</div>
    <div style="display:flex;gap:8px">
      <button id="pragma-copy" style="flex:1;padding:8px;border:0;border-radius:6px;cursor:pointer">Copiar</button>
      <button id="pragma-insert" style="flex:1;padding:8px;border:0;border-radius:6px;cursor:pointer">Insertar</button>
    </div>
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

window.PragmaConcierge = {
  detectPlatform,
  showConciergePanel,
  sendToBackground,
};
