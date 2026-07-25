/**
 * Watchdog — evaluates runtime health and recommends recovery (pure).
 */
import { superviseChannels } from "@/modules/ai-concierge/runtime/channel-supervisor";
import type {
  ConciergeRuntimeStatus,
  ConciergeWatchdogVerdict,
} from "@/modules/ai-concierge/runtime/types";

export function runConciergeWatchdog(input: {
  desiredOn: boolean;
  status: ConciergeRuntimeStatus;
  whatsappEnabled: boolean;
  airbnbEnabled: boolean;
  channelStatus: unknown;
  linkHeartbeatAt: Date | string | null | undefined;
  extensionConnected: boolean;
  lastError?: string | null;
  nowMs?: number;
}): ConciergeWatchdogVerdict {
  if (!input.desiredOn) {
    return {
      healthy: true,
      issues: [],
      recommendedStatus: input.status === "OFF" ? "OFF" : "STOPPING",
      commands: [{ type: "stop_processing" }],
    };
  }

  const supervised = superviseChannels({
    whatsappEnabled: input.whatsappEnabled,
    airbnbEnabled: input.airbnbEnabled,
    channelStatus: input.channelStatus,
    linkHeartbeatAt: input.linkHeartbeatAt,
    extensionConnected: input.extensionConnected,
    nowMs: input.nowMs,
  });

  if (!input.extensionConnected) {
    return {
      healthy: false,
      issues: supervised.issues,
      recommendedStatus: "RECOVERING",
      commands: [{ type: "reconnect_channels" }, { type: "slow_poll" }],
    };
  }

  const anyChannelExpected =
    input.whatsappEnabled || input.airbnbEnabled;
  const anyConnected = supervised.channels.some((c) => c.connected);

  if (anyChannelExpected && !anyConnected) {
    return {
      healthy: false,
      issues: supervised.issues.length
        ? supervised.issues
        : ["Ningún canal activo"],
      recommendedStatus: "RECOVERING",
      commands: [
        ...supervised.commands,
        { type: "reconnect_channels" },
        { type: "fast_poll" },
      ],
    };
  }

  if (input.lastError && input.status === "ERROR") {
    return {
      healthy: false,
      issues: [input.lastError, ...supervised.issues],
      recommendedStatus: "RECOVERING",
      commands: [{ type: "reconnect_channels" }, { type: "fast_poll" }],
    };
  }

  if (input.status === "STARTING" || input.status === "RECOVERING") {
    return {
      healthy: true,
      issues: [],
      recommendedStatus: "RUNNING",
      commands: [{ type: "fast_poll" }],
    };
  }

  return {
    healthy: true,
    issues: supervised.issues.filter((i) => !i.includes("stale")),
    recommendedStatus: "RUNNING",
    commands: anyConnected ? [{ type: "none" }] : [{ type: "slow_poll" }],
  };
}
