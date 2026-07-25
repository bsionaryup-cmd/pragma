/**
 * Session lifecycle — one conversation = one session.
 * Reuses ConciergeConversationState / fact-memory (no new engine).
 *
 * Permanent: official PMS identifiers already stored (reservationId).
 * Ephemeral: funnel slots, protocol, guestName, recent snippets.
 */
import type {
  ConciergeConversationFlowState,
  ConciergeFactMap,
  ConciergeRecentSnippet,
} from "@/modules/ai-concierge/memory/fact-memory";

/** Full session close — days later / long idle → start from zero. */
export const CONCIERGE_SESSION_IDLE_MS = 4 * 60 * 60 * 1000; // 4h

function lastActivityMs(recent: Array<{ at?: string }>): number | null {
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const at = recent[i]?.at;
    if (!at) continue;
    const ms = new Date(at).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

/** Facts that may survive a closed session (official PRAGMA data only). */
const PERMANENT_FACT_KEYS = new Set([
  "reservationId",
  "reservationCreated",
]);

/** Slot / protocol facts cleared when a workflow idles (8 min), guestName kept. */
const WORKFLOW_EPHEMERAL_KEYS = [
  "checkIn",
  "checkOut",
  "guests",
  "bookingConfirmed",
  "flowTopic",
  "contextLocked",
  "activeWorkflow",
  "activeProtocol",
  "protocolStep",
  "reservationWorkflowStep",
  "lastToolOutcome",
  "menuOffered",
  "quoteSummary",
  "stayTotal",
] as const;

export function emptyConversationFlow(): ConciergeConversationFlowState {
  return {
    topic: null,
    flow: null,
    pendingAction: null,
    awaitingReply: false,
    lastIntent: null,
  };
}

export function stripEphemeralFacts(facts: ConciergeFactMap): ConciergeFactMap {
  const out: ConciergeFactMap = {};
  for (const [k, v] of Object.entries(facts)) {
    if (PERMANENT_FACT_KEYS.has(k)) out[k] = v;
  }
  return out;
}

export function stripWorkflowEphemeralFacts(
  facts: ConciergeFactMap,
): ConciergeFactMap {
  const out: ConciergeFactMap = { ...facts };
  for (const key of WORKFLOW_EPHEMERAL_KEYS) {
    delete out[key];
  }
  return out;
}

export function isSessionIdle(
  recent: Array<{ at?: string }>,
  nowMs = Date.now(),
): boolean {
  const last = lastActivityMs(recent);
  if (last == null) return false;
  return nowMs - last >= CONCIERGE_SESSION_IDLE_MS;
}

/**
 * Close when fact TTL expired or long idle — never reuse closed-session context.
 */
export function shouldCloseConciergeSession(input: {
  expired: boolean;
  recent: Array<{ at?: string }>;
  nowMs?: number;
}): boolean {
  if (input.expired) return true;
  return isSessionIdle(input.recent, input.nowMs ?? Date.now());
}

export function closeConciergeSession(input: {
  facts: ConciergeFactMap;
  reservationId?: string | null;
}): {
  facts: ConciergeFactMap;
  flow: ConciergeConversationFlowState;
  recent: ConciergeRecentSnippet[];
  closed: true;
} {
  const facts = stripEphemeralFacts(input.facts);
  if (input.reservationId && !facts.reservationId) {
    facts.reservationId = input.reservationId;
    facts.reservationCreated = true;
  }
  return {
    facts,
    flow: emptyConversationFlow(),
    recent: [],
    closed: true,
  };
}
