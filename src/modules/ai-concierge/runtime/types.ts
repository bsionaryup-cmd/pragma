/**
 * Concierge Runtime Autónomo — types (pure, no server-only).
 */

export const CONCIERGE_RUNTIME_STATUSES = [
  "OFF",
  "STARTING",
  "RUNNING",
  "RECOVERING",
  "ERROR",
  "STOPPING",
] as const;

export type ConciergeRuntimeStatus = (typeof CONCIERGE_RUNTIME_STATUSES)[number];

export type ConciergeRuntimeTransition = {
  from: ConciergeRuntimeStatus;
  to: ConciergeRuntimeStatus;
  reason: string;
  at: string;
};

export type ConciergeChannelHealth = {
  channel: "whatsapp_web" | "airbnb_web";
  connected: boolean;
  lastHeartbeatAt: string | null;
  lastSyncAt: string | null;
  lastMessageAt: string | null;
  error: string | null;
  latencyMs: number | null;
  role: string | null;
};

export type ConciergeWatchdogVerdict = {
  healthy: boolean;
  issues: string[];
  recommendedStatus: ConciergeRuntimeStatus;
  commands: ConciergeRuntimeCommand[];
};

export type ConciergeRuntimeCommand =
  | { type: "none" }
  | { type: "reconnect_channels" }
  | { type: "recover_tab"; channel: "whatsapp_web" | "airbnb_web" }
  | { type: "slow_poll" }
  | { type: "fast_poll" }
  | { type: "stop_processing" };

export type ConciergeQueuePriority = "emergency" | "active_guest" | "recent" | "normal";

export type ConciergeQueuedTurn = {
  id: string;
  organizationId: string;
  channel: string;
  threadId: string;
  guestMessage: string;
  priority: ConciergeQueuePriority;
  enqueuedAt: number;
  externalMessageId?: string | null;
};
