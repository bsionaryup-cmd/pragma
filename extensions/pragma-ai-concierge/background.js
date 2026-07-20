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
    "ngrok-skip-browser-warning": "true",
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
  if (message.type === "CONCIERGE_TURN_LOCK") {
    const inFlight = Boolean(message.payload?.inFlight);
    chrome.storage.local
      .set({
        conciergeTurnInFlight: inFlight,
        conciergeTurnInFlightAt: inFlight ? Date.now() : null,
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: String(error) }),
      );
    return true;
  }
});

const SAFE_RELOAD_MIN_INTERVAL_MS = 45 * 60 * 1000;
const TURN_LOCK_STALE_MS = 120_000;

async function pingWhatsAppTabs() {
  const result = {
    anyAlive: false,
    tabCount: 0,
    discardedCount: 0,
    responded: 0,
  };
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://web.whatsapp.com/*"],
    });
    result.tabCount = tabs.length;
    for (const tab of tabs) {
      if (typeof tab.id !== "number") continue;
      if (tab.discarded) {
        result.discardedCount += 1;
        continue;
      }
      try {
        const res = await chrome.tabs.sendMessage(tab.id, {
          type: "CONCIERGE_PING",
        });
        if (res?.ok) {
          result.anyAlive = true;
          result.responded += 1;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return result;
}

async function mergeWhatsAppStatus(patch) {
  const stored = await chrome.storage.local.get(CHANNEL_STATUS_KEY);
  const prev = (stored[CHANNEL_STATUS_KEY] || {}).whatsapp_web || {};
  const next = {
    ...(stored[CHANNEL_STATUS_KEY] || {}),
    whatsapp_web: {
      ...prev,
      ...patch,
      at: new Date().toISOString(),
    },
  };
  await chrome.storage.local.set({ [CHANNEL_STATUS_KEY]: next });
  return next.whatsapp_web;
}

async function maybeSafeReloadWhatsApp(reason) {
  const stored = await chrome.storage.local.get([
    "conciergeTurnInFlight",
    "conciergeTurnInFlightAt",
    "conciergeLastSafeReloadAt",
    "conciergeOutboundQueue",
    CHANNEL_STATUS_KEY,
  ]);
  if (stored.conciergeTurnInFlight) {
    const lockedAt = Number(stored.conciergeTurnInFlightAt || 0);
    if (lockedAt && Date.now() - lockedAt < TURN_LOCK_STALE_MS) {
      return { reloaded: false, skipped: "turn_in_flight" };
    }
  }
  const queue = Array.isArray(stored.conciergeOutboundQueue)
    ? stored.conciergeOutboundQueue
    : [];
  if (queue.length > 0) {
    return { reloaded: false, skipped: "outbound_pending" };
  }
  const wa = (stored[CHANNEL_STATUS_KEY] || {}).whatsapp_web || {};
  if (wa.needs_auth === true || wa.network_down === true) {
    return { reloaded: false, skipped: "hard_stop_state" };
  }
  const last = Number(stored.conciergeLastSafeReloadAt || 0);
  if (Date.now() - last < SAFE_RELOAD_MIN_INTERVAL_MS) {
    return { reloaded: false, skipped: "rate_limited" };
  }
  const ping = await pingWhatsAppTabs();
  if (ping.anyAlive) {
    return { reloaded: false, skipped: "tab_alive" };
  }
  if (ping.tabCount === 0) {
    return { reloaded: false, skipped: "no_tab" };
  }
  await chrome.storage.local.set({
    conciergeLastSafeReloadAt: Date.now(),
    conciergeLastSafeReloadReason: reason || "recover",
  });
  await reloadWhatsAppTabs();
  return { reloaded: true, reason: reason || "recover" };
}

async function sendHeartbeat() {
  const ping = await pingWhatsAppTabs();
  const stored = await chrome.storage.local.get([
    CHANNEL_STATUS_KEY,
    "conciergeNetworkDown",
  ]);
  let channels = { ...(stored[CHANNEL_STATUS_KEY] || {}) };
  const prevWa = channels.whatsapp_web || {};
  const networkDown = Boolean(stored.conciergeNetworkDown);

  if (ping.tabCount === 0) {
    channels.whatsapp_web = {
      ...prevWa,
      channel: "whatsapp_web",
      connected: false,
      tabAlive: false,
      tabAliveAt: null,
      tabCount: 0,
      network_down: networkDown,
      disconnectReason: "no_tab",
      at: new Date().toISOString(),
    };
  } else if (!ping.anyAlive) {
    channels.whatsapp_web = {
      ...prevWa,
      channel: "whatsapp_web",
      connected: false,
      tabAlive: false,
      tabAliveAt: null,
      tabCount: ping.tabCount,
      discardedCount: ping.discardedCount,
      network_down: networkDown,
      disconnectReason: ping.discardedCount ? "tab_discarded" : "tab_unresponsive",
      at: new Date().toISOString(),
    };
  } else {
    channels.whatsapp_web = {
      ...prevWa,
      channel: "whatsapp_web",
      tabAlive: true,
      tabAliveAt: new Date().toISOString(),
      tabCount: ping.tabCount,
      responded: ping.responded,
      network_down: networkDown,
      // connected left to content script session flags; server still requires tabAliveAt
      connected:
        prevWa.needs_auth === true || networkDown
          ? false
          : prevWa.connected !== false,
    };
  }

  await chrome.storage.local.set({ [CHANNEL_STATUS_KEY]: channels });

  const result = await apiFetch("/api/concierge/heartbeat", {
    method: "POST",
    body: {
      version: extensionVersion(),
      channels,
      error: networkDown ? "network_down" : null,
    },
  });

  if (result.status === 0) {
    await chrome.storage.local.set({ conciergeNetworkDown: true });
    await mergeWhatsAppStatus({
      network_down: true,
      connected: false,
      disconnectReason: "network_down",
    });
  } else if (result.ok) {
    await chrome.storage.local.set({ conciergeNetworkDown: false });
  }

  const runtime = result?.data?.runtime;
  const patch = {
    conciergeLastHealth: {
      at: new Date().toISOString(),
      ok: Boolean(result.ok),
      status: result.status,
      runtimeStatus: runtime?.status || null,
      processing: runtime?.processing ?? null,
      tabPing: ping,
    },
  };
  if (
    typeof runtime?.pollIntervalMs === "number" &&
    runtime.pollIntervalMs >= 1000
  ) {
    patch.conciergePollIntervalMs = runtime.pollIntervalMs;
  }

  const commands = Array.isArray(runtime?.commands) ? runtime.commands : [];
  let needsReconnect = false;
  let needsSafeReload = false;
  for (const cmd of commands) {
    if (
      cmd?.type === "reconnect_channels" ||
      cmd?.type === "recover_tab"
    ) {
      needsReconnect = true;
      if (!ping.anyAlive && ping.tabCount > 0) {
        needsSafeReload = true;
      }
    }
  }
  if (needsReconnect) {
    patch.conciergeReconnectAt = Date.now();
  }
  await chrome.storage.local.set(patch);

  if (needsSafeReload) {
    await maybeSafeReloadWhatsApp("watchdog_recover_tab").catch(() => {});
  }

  return result;
}

async function ensureHeartbeatAlarm() {
  await chrome.alarms.create("concierge-heartbeat", { periodInMinutes: 1 });
}

/** Re-inject content scripts so WhatsApp can keep answering after Reload. */
async function reloadWhatsAppTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://web.whatsapp.com/*"],
    });
    await Promise.all(
      tabs
        .filter((tab) => typeof tab.id === "number")
        .map((tab) => chrome.tabs.reload(tab.id).catch(() => {})),
    );
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  ensureHeartbeatAlarm().catch(() => {});
  reloadWhatsAppTabs().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  ensureHeartbeatAlarm().catch(() => {});
  // Post-suspend / Chrome restart: immediate honesty + soft recover signal.
  chrome.storage.local
    .set({ conciergeReconnectAt: Date.now(), conciergeWakeAt: Date.now() })
    .then(() => sendHeartbeat())
    .catch(() => {});
});
ensureHeartbeatAlarm().catch(() => {});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "concierge-heartbeat") {
    sendHeartbeat().catch(() => {});
  }
});
