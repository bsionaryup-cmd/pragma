/**
 * Channel supervisor — evaluates WA/Airbnb health from extension heartbeats.
 */
import type {
  ConciergeChannelHealth,
  ConciergeRuntimeCommand,
} from "@/modules/ai-concierge/runtime/types";

const STALE_MS = 90_000;

export function evaluateChannelHealth(input: {
  channel: "whatsapp_web" | "airbnb_web";
  channelStatus: unknown;
  linkHeartbeatAt: Date | string | null | undefined;
  nowMs?: number;
}): ConciergeChannelHealth {
  const now = input.nowMs ?? Date.now();
  const row =
    input.channelStatus &&
    typeof input.channelStatus === "object" &&
    !Array.isArray(input.channelStatus)
      ? (
          input.channelStatus as Record<
            string,
            {
              connected?: unknown;
              at?: unknown;
              lastMessageAt?: unknown;
              error?: unknown;
              latencyMs?: unknown;
              role?: unknown;
            }
          >
        )[input.channel]
      : undefined;

  const at =
    typeof row?.at === "string"
      ? row.at
      : input.linkHeartbeatAt
        ? new Date(input.linkHeartbeatAt).toISOString()
        : null;
  const connected =
    row?.connected === true &&
    Boolean(at) &&
    now - new Date(at!).getTime() < STALE_MS;

  return {
    channel: input.channel,
    connected,
    lastHeartbeatAt: at,
    lastSyncAt: at,
    lastMessageAt: typeof row?.lastMessageAt === "string" ? row.lastMessageAt : null,
    error: typeof row?.error === "string" ? row.error : null,
    latencyMs:
      typeof row?.latencyMs === "number" && Number.isFinite(row.latencyMs)
        ? row.latencyMs
        : null,
    role: typeof row?.role === "string" ? row.role : null,
  };
}

export function superviseChannels(input: {
  whatsappEnabled: boolean;
  airbnbEnabled: boolean;
  channelStatus: unknown;
  linkHeartbeatAt: Date | string | null | undefined;
  extensionConnected: boolean;
  nowMs?: number;
}): {
  channels: ConciergeChannelHealth[];
  commands: ConciergeRuntimeCommand[];
  issues: string[];
} {
  const channels: ConciergeChannelHealth[] = [];
  const issues: string[] = [];
  const commands: ConciergeRuntimeCommand[] = [];

  if (!input.extensionConnected) {
    issues.push("Extensión sin heartbeat reciente");
    commands.push({ type: "reconnect_channels" });
  }

  if (input.whatsappEnabled) {
    const wa = evaluateChannelHealth({
      channel: "whatsapp_web",
      channelStatus: input.channelStatus,
      linkHeartbeatAt: input.linkHeartbeatAt,
      nowMs: input.nowMs,
    });
    channels.push(wa);
    if (!wa.connected) {
      issues.push("WhatsApp Web no conectado o stale");
      commands.push({ type: "recover_tab", channel: "whatsapp_web" });
    }
    if (wa.error) issues.push(`WhatsApp: ${wa.error}`);
  }

  if (input.airbnbEnabled) {
    const air = evaluateChannelHealth({
      channel: "airbnb_web",
      channelStatus: input.channelStatus,
      linkHeartbeatAt: input.linkHeartbeatAt,
      nowMs: input.nowMs,
    });
    channels.push(air);
    if (!air.connected) {
      issues.push("Airbnb Web no conectado o stale");
      commands.push({ type: "recover_tab", channel: "airbnb_web" });
    }
    if (air.error) issues.push(`Airbnb: ${air.error}`);
  }

  return { channels, commands, issues };
}
