const DEFAULTS = {
  apiBase: "http://127.0.0.1:3000",
  secret: "",
  orgId: "",
  userId: "",
  mode: "manual",
};

async function getConfig() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function apiFetch(path, { method = "GET", body, mode } = {}) {
  const cfg = await getConfig();
  const headers = {
    authorization: `Bearer ${cfg.secret}`,
    "x-concierge-org-id": cfg.orgId,
    "x-concierge-user-id": cfg.userId,
    "x-concierge-mode": mode || cfg.mode || "manual",
  };
  if (body) headers["content-type"] = "application/json";

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`${cfg.apiBase}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data, attempt };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return { ok: false, status: 0, data: { error: String(lastError) }, attempt: 3 };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;
  if (message.type === "CONCIERGE_INGEST") {
    apiFetch("/api/concierge/channel/ingest", {
      method: "POST",
      body: message.payload,
      mode: "observe",
    })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message.type === "CONCIERGE_TURN") {
    apiFetch("/api/concierge/channel/turn", {
      method: "POST",
      body: message.payload,
    })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message.type === "CONCIERGE_HEALTH") {
    apiFetch("/api/concierge/health", { method: "GET" })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});

// Health probe cada 60s para detectar pérdida de API
setInterval(() => {
  apiFetch("/api/concierge/health", { method: "GET" }).then((res) => {
    chrome.storage.local.set({
      conciergeLastHealth: {
        at: new Date().toISOString(),
        ok: Boolean(res.ok),
        status: res.status,
      },
    });
  });
}, 60_000);
