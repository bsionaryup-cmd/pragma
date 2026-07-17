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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;
  if (message.type === "CONCIERGE_INGEST") {
    handleIngest(message.payload).then(sendResponse).catch((err) =>
      sendResponse({ ok: false, error: String(err) }),
    );
    return true;
  }
  if (message.type === "CONCIERGE_TURN") {
    handleTurn(message.payload).then(sendResponse).catch((err) =>
      sendResponse({ ok: false, error: String(err) }),
    );
    return true;
  }
});

async function handleIngest(payload) {
  const cfg = await getConfig();
  const res = await fetch(`${cfg.apiBase}/api/concierge/channel/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.secret}`,
      "x-concierge-org-id": cfg.orgId,
      "x-concierge-user-id": cfg.userId,
      "x-concierge-mode": "observe",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function handleTurn(payload) {
  const cfg = await getConfig();
  const res = await fetch(`${cfg.apiBase}/api/concierge/channel/turn`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.secret}`,
      "x-concierge-org-id": cfg.orgId,
      "x-concierge-user-id": cfg.userId,
      "x-concierge-mode": cfg.mode || "manual",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
