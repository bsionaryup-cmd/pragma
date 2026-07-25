/**
 * Ephemeral fact memory — persist facts only, with TTL.
 * Never stores full conversation transcripts.
 */
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export const CONCIERGE_FACT_TTL_MS = 1000 * 60 * 60 * 48; // 48h
export const CONCIERGE_RECENT_MESSAGE_CAP = 12;

export type ConciergeFactMap = Record<string, string | number | boolean | null>;

export type ConciergeConversationFlowState = {
  topic: string | null;
  flow: string | null;
  pendingAction: string | null;
  awaitingReply: boolean;
  lastIntent: string | null;
};

export type ConciergeRecentSnippet = {
  role: "guest" | "agent" | "system";
  body: string;
  at: string;
};

export function hashConciergeThread(input: {
  organizationId: string;
  channel: string;
  threadId: string;
}): string {
  return createHash("sha256")
    .update(`${input.organizationId}:${input.channel}:${input.threadId}`)
    .digest("hex");
}

function asFactMap(value: unknown): ConciergeFactMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: ConciergeFactMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      v === null
    ) {
      out[k] = v;
    }
  }
  return out;
}

function asFlowState(value: unknown): ConciergeConversationFlowState {
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    topic: typeof row.topic === "string" ? row.topic : null,
    flow: typeof row.flow === "string" ? row.flow : null,
    pendingAction: typeof row.pendingAction === "string" ? row.pendingAction : null,
    awaitingReply: row.awaitingReply === true,
    lastIntent: typeof row.lastIntent === "string" ? row.lastIntent : null,
  };
}

function asRecent(value: unknown): ConciergeRecentSnippet[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      const role: ConciergeRecentSnippet["role"] =
        row.role === "agent" || row.role === "system" || row.role === "guest"
          ? row.role
          : row.role === "assistant"
            ? "agent"
            : "guest";
      return {
        role,
        body: typeof row.body === "string" ? row.body.slice(0, 500) : "",
        at: typeof row.at === "string" ? row.at : new Date().toISOString(),
      };
    })
    .filter((item) => item.body.trim().length > 0)
    .slice(-CONCIERGE_RECENT_MESSAGE_CAP);
}

export async function loadConciergeThreadMemory(input: {
  organizationId: string;
  channel: string;
  threadId: string;
}): Promise<{
  facts: ConciergeFactMap;
  flow: ConciergeConversationFlowState;
  recent: ConciergeRecentSnippet[];
  propertyId: string | null;
  reservationId: string | null;
  expired: boolean;
}> {
  const threadHash = hashConciergeThread(input);
  const row = await db.conciergeConversationState.findUnique({
    where: {
      organizationId_channel_threadHash: {
        organizationId: input.organizationId,
        channel: input.channel,
        threadHash,
      },
    },
    select: {
      factsJson: true,
      conversationStateJson: true,
      recentMessagesJson: true,
      factsExpiresAt: true,
      propertyId: true,
      reservationId: true,
    },
  });

  if (!row) {
    return {
      facts: {},
      flow: {
        topic: null,
        flow: null,
        pendingAction: null,
        awaitingReply: false,
        lastIntent: null,
      },
      recent: [],
      propertyId: null,
      reservationId: null,
      expired: false,
    };
  }

  const expired =
    Boolean(row.factsExpiresAt) && row.factsExpiresAt!.getTime() < Date.now();

  // TTL expiry is handled by session-lifecycle on the next compose turn
  // (closeConciergeSession). Mid-conversation loads keep facts so slot capture
  // is not wiped by a stale clock while the guest is still typing.
  return {
    facts: asFactMap(row.factsJson),
    flow: asFlowState(row.conversationStateJson),
    recent: asRecent(row.recentMessagesJson),
    propertyId: row.propertyId,
    reservationId: row.reservationId,
    expired,
  };
}

export async function saveConciergeThreadMemory(input: {
  organizationId: string;
  channel: string;
  threadId: string;
  facts: ConciergeFactMap;
  flow: ConciergeConversationFlowState;
  recent: ConciergeRecentSnippet[];
  propertyId?: string | null;
  reservationId?: string | null;
}): Promise<void> {
  const threadHash = hashConciergeThread(input);
  const expiresAt = new Date(Date.now() + CONCIERGE_FACT_TTL_MS);
  const recent = input.recent.slice(-CONCIERGE_RECENT_MESSAGE_CAP);

  await db.conciergeConversationState.upsert({
    where: {
      organizationId_channel_threadHash: {
        organizationId: input.organizationId,
        channel: input.channel,
        threadHash,
      },
    },
    create: {
      organizationId: input.organizationId,
      channel: input.channel,
      threadHash,
      factsJson: input.facts,
      conversationStateJson: input.flow,
      recentMessagesJson: recent,
      factsExpiresAt: expiresAt,
      propertyId: input.propertyId ?? null,
      reservationId: input.reservationId ?? null,
      lastIntent: input.flow.lastIntent,
    },
    update: {
      factsJson: input.facts,
      conversationStateJson: input.flow,
      recentMessagesJson: recent,
      factsExpiresAt: expiresAt,
      propertyId: input.propertyId ?? undefined,
      reservationId: input.reservationId ?? undefined,
      lastIntent: input.flow.lastIntent,
    },
  });
}

export function mergeFacts(
  base: ConciergeFactMap,
  extra: ConciergeFactMap,
): ConciergeFactMap {
  return { ...base, ...extra };
}

export function deriveFlowFromIntent(input: {
  intent: string;
  path: string;
  previous: ConciergeConversationFlowState;
}): ConciergeConversationFlowState {
  const awaitingReply =
    input.path === "needs_tools" ||
    input.path === "needs_llm" ||
    input.path === "escalate";

  let pendingAction = input.previous.pendingAction;
  let flow = input.previous.flow;
  const topic = input.intent;

  if (input.intent === "TTLOCK") {
    flow = "access";
    pendingAction =
      input.path === "deterministic" ? null : "awaiting_access_facts";
  } else if (input.intent === "GUEST_REGISTRATION") {
    flow = "guest_registration";
    pendingAction =
      input.path === "deterministic" ? "registration_complete" : "awaiting_gr_status";
  } else if (input.intent === "EARLY_CHECKIN" || input.intent === "LATE_CHECKOUT") {
    flow = "schedule_exception";
    pendingAction = input.path === "escalate" ? "human_review" : "awaiting_confirmation";
  } else if (input.path === "deterministic") {
    pendingAction = null;
  }

  return {
    topic,
    flow,
    pendingAction,
    awaitingReply,
    lastIntent: input.intent,
  };
}
