const SESSION_KEY = "conciergeSession";
const DEVICE_KEY = "conciergeDeviceId";
const CHANNEL_STATUS_KEY = "conciergeChannelStatus";

function extensionVersion() {
  return chrome.runtime.getManifest().version;
}

async function getDeviceId() {
  const stored = await chrome.storage.local.get(DEVICE_KEY);
  if (stored[DEVICE_KEY]) return stored[DEVICE_KEY];
  const deviceId = crypto.randomUUID();
  await chrome.storage.local.set({ [DEVICE_KEY]: deviceId });
  return deviceId;
}

async function getSession() {
  const fromSession = await chrome.storage.session.get(SESSION_KEY);
  let session = fromSession[SESSION_KEY];
  if (!session?.token) {
    const fromLocal = await chrome.storage.local.get(SESSION_KEY);
    session = fromLocal[SESSION_KEY];
  }
  if (!session?.token || !session?.apiBase || !session?.expiresAt) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now() + 5_000) {
    await chrome.storage.session.remove(SESSION_KEY);
    await chrome.storage.local.remove(SESSION_KEY);
    return null;
  }
  return session;
}

async function setSession(session) {
  await Promise.all([
    chrome.storage.session.set({ [SESSION_KEY]: session }),
    chrome.storage.local.set({ [SESSION_KEY]: session }),
  ]);
}

function isAllowedPragmaOrigin(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === "3000"
    ) {
      return true;
    }
    return (
      url.protocol === "https:" &&
      (url.hostname === "pragmapms.com" ||
        url.hostname.endsWith(".pragmapms.com"))
    );
  } catch {
    return false;
  }
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      status: 401,
      data: { error: "Extensión no vinculada. Abre AI Concierge en PRAGMA." },
    };
  }
  const headers = {
    authorization: `Bearer ${session.token}`,
  };
  if (body) headers["content-type"] = "application/json";

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`${session.apiBase}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        await chrome.storage.session.remove(SESSION_KEY);
        await chrome.storage.local.remove(SESSION_KEY);
      }
      return { ok: res.ok, status: res.status, data, attempt };
    } catch (err) {
      lastError = err;
      await new Promise((resolve) =>
        setTimeout(resolve, 400 * (attempt + 1)),
      );
    }
  }
  return {
    ok: false,
    status: 0,
    data: { error: String(lastError) },
    attempt: 3,
  };
}

async function completePairing(payload, sender) {
  const senderOrigin = sender?.url ? new URL(sender.url).origin : "";
  if (
    !payload?.apiBase ||
    !payload?.pairingToken ||
    !isAllowedPragmaOrigin(senderOrigin) ||
    new URL(payload.apiBase).origin !== senderOrigin
  ) {
    return { ok: false, error: "Origen PRAGMA no autorizado" };
  }
  const deviceId = await getDeviceId();
  const res = await fetch(`${senderOrigin}/api/concierge/link/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      pairingToken: payload.pairingToken,
      deviceId,
      version: extensionVersion(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    return {
      ok: false,
      error: data.error || `HTTP ${res.status}`,
    };
  }
  await setSession({
    apiBase: senderOrigin,
    token: data.token,
    expiresAt: data.expiresAt,
  });
  await ensureHeartbeatAlarm();
  const heartbeat = await sendHeartbeat();
  if (!heartbeat.ok) {
    return {
      ok: false,
      error:
        heartbeat.data?.error ||
        `Heartbeat falló (HTTP ${heartbeat.status}). Reintenta desde PRAGMA.`,
    };
  }
  return { ok: true, deviceId, version: extensionVersion() };
}

async function acceptSession(payload, sender) {
  const senderOrigin = sender?.url ? new URL(sender.url).origin : "";
  if (
    !payload?.token ||
    !payload?.expiresAt ||
    !payload?.apiBase ||
    !isAllowedPragmaOrigin(senderOrigin) ||
    new URL(payload.apiBase).origin !== senderOrigin
  ) {
    return { ok: false, error: "Sesión PRAGMA inválida" };
  }
  await setSession({
    apiBase: senderOrigin,
    token: payload.token,
    expiresAt: payload.expiresAt,
  });
  await ensureHeartbeatAlarm();
  const heartbeat = await sendHeartbeat();
  if (!heartbeat.ok) {
    return {
      ok: false,
      error:
        heartbeat.data?.error ||
        `Heartbeat falló (HTTP ${heartbeat.status}). Reintenta desde PRAGMA.`,
    };
  }
  return {
    ok: true,
    deviceId: await getDeviceId(),
    version: extensionVersion(),
  };
}

chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "PRAGMA_CONCIERGE_DISCOVER") {
      getDeviceId()
        .then((deviceId) =>
          sendResponse({
            ok: true,
            deviceId,
            version: extensionVersion(),
          }),
        )
        .catch((error) =>
          sendResponse({ ok: false, error: String(error) }),
        );
      return true;
    }
    if (message.type === "PRAGMA_CONCIERGE_PAIR") {
      completePairing(message.payload, sender)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({ ok: false, error: String(error) }),
        );
      return true;
    }
    if (message.type === "PRAGMA_CONCIERGE_SESSION") {
      acceptSession(message.payload, sender)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({ ok: false, error: String(error) }),
        );
      return true;
    }
    if (message.type === "PRAGMA_CONCIERGE_RECONNECT") {
      chrome.storage.local
        .set({ conciergeReconnectAt: new Date().toISOString() })
        .then(() => sendResponse({ ok: true }))
        .catch((error) =>
          sendResponse({ ok: false, error: String(error) }),
        );
      return true;
    }
  },
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;
  if (message.type === "CONCIERGE_INGEST") {
    apiFetch("/api/concierge/channel/ingest", {
      method: "POST",
      body: message.payload,
    })
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ ok: false, error: String(error) }),
      );
    return true;
  }
  if (message.type === "CONCIERGE_TURN") {
    apiFetch("/api/concierge/channel/turn", {
      method: "POST",
      body: message.payload,
    })
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ ok: false, error: String(error) }),
      );
    return true;
  }
  if (message.type === "CONCIERGE_HEALTH") {
    apiFetch("/api/concierge/health")
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ ok: false, error: String(error) }),
      );
    return true;
  }
  if (message.type === "CONCIERGE_CHANNEL_STATUS") {
    chrome.storage.local
      .get(CHANNEL_STATUS_KEY)
      .then((stored) => {
        const channel = message.payload?.channel || "unknown";
        const previous = (stored[CHANNEL_STATUS_KEY] || {})[channel] || {};
        // Merge so thin presence ticks do not wipe mayAutoSend / sent / suggestedPreview.
        return {
          ...(stored[CHANNEL_STATUS_KEY] || {}),
          [channel]: {
            ...previous,
            ...message.payload,
            at: new Date().toISOString(),
          },
        };
      })
      .then((status) =>
        chrome.storage.local.set({ [CHANNEL_STATUS_KEY]: status }),
      )
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: String(error) }),
      );
    return true;
  }
});

async function sendHeartbeat() {
  const stored = await chrome.storage.local.get(CHANNEL_STATUS_KEY);
  const result = await apiFetch("/api/concierge/heartbeat", {
    method: "POST",
    body: {
      version: extensionVersion(),
      channels: stored[CHANNEL_STATUS_KEY] || {},
      error: null,
    },
  });
  await chrome.storage.local.set({
    conciergeLastHealth: {
      at: new Date().toISOString(),
      ok: Boolean(result.ok),
      status: result.status,
    },
  });
  return result;
}

async function ensureHeartbeatAlarm() {
  await chrome.alarms.create("concierge-heartbeat", { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureHeartbeatAlarm().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  ensureHeartbeatAlarm().catch(() => {});
});
ensureHeartbeatAlarm().catch(() => {});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "concierge-heartbeat") {
    sendHeartbeat().catch(() => {});
  }
});
