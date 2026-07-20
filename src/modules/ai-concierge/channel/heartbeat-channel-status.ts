/**
 * Honest channelStatus merge for extension heartbeats.
 * WhatsApp Web must present a fresh tabAliveAt to stay "connected".
 * Does not touch Concierge compose / mayAutoSend logic.
 */

const TAB_ALIVE_MAX_AGE_MS = 90_000;

export type HeartbeatChannelRow = Record<string, unknown>;

function isFreshIso(at: unknown, nowMs: number, maxAgeMs: number): boolean {
  if (typeof at !== "string" || !at) return false;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  return nowMs - t <= maxAgeMs;
}

/**
 * Normalize one channel row from the extension before persisting.
 * - whatsapp_web: connected only if tabAliveAt is fresh (or legacy without the field → disconnect).
 * - other channels: renew `at` when connected=true (prior behavior for Airbnb quiet tabs).
 */
export function normalizeHeartbeatChannelRow(
  channelKey: string,
  value: unknown,
  now: Date = new Date(),
): HeartbeatChannelRow | unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const row = { ...(value as HeartbeatChannelRow) };
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  if (channelKey === "whatsapp_web") {
    const tabAliveFresh = isFreshIso(row.tabAliveAt, nowMs, TAB_ALIVE_MAX_AGE_MS);
    const explicitDead =
      row.tabAlive === false ||
      row.needs_auth === true ||
      row.network_down === true;

    if (explicitDead || !tabAliveFresh) {
      return {
        ...row,
        connected: false,
        at: nowIso,
        disconnectReason:
          row.needs_auth === true
            ? "needs_auth"
            : row.network_down === true
              ? "network_down"
              : row.tabAlive === false
                ? "tab_dead"
                : "tab_alive_stale",
      };
    }

    return {
      ...row,
      connected: true,
      at: nowIso,
    };
  }

  if (row.connected === true) {
    return { ...row, at: nowIso };
  }
  return row;
}

export function normalizeHeartbeatChannels(
  channels: Record<string, unknown> | null | undefined,
  now: Date = new Date(),
): Record<string, unknown> | undefined {
  if (!channels) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(channels)) {
    out[key] = normalizeHeartbeatChannelRow(key, value, now);
  }
  return out;
}
