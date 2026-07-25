/**
 * Conversation Manager — state / resume facade over fact-memory.
 * Does not own send/receive; only persistence helpers.
 */
import {
  loadConciergeThreadMemory,
  saveConciergeThreadMemory,
  type ConciergeFactMap,
  type ConciergeConversationFlowState,
  type ConciergeRecentSnippet,
} from "@/modules/ai-concierge/memory/fact-memory";
import { mapPendingActionToStep } from "@/modules/ai-concierge/conversation-engine/intent-router";
import type { ConversationEngineSession } from "@/modules/ai-concierge/conversation-engine/types";

export async function loadConversationSession(input: {
  organizationId: string;
  channel: string;
  threadId: string;
}): Promise<ConversationEngineSession> {
  const mem = await loadConciergeThreadMemory(input);
  const pending = mem.flow.pendingAction;
  const step = mapPendingActionToStep(pending) ?? mem.flow.flow;
  const status: ConversationEngineSession["status"] =
    pending === "human_review"
      ? "escalated"
      : pending === "booking_created"
        ? "finished"
        : mem.expired
          ? "idle"
          : "active";

  return {
    organizationId: input.organizationId,
    phoneOrThreadId: input.threadId,
    workflowId: mem.flow.topic ?? mem.flow.flow,
    step,
    context: mem.facts,
    lastInteractionAt: mem.recent.at(-1)?.at ?? null,
    status,
  };
}

export async function persistConversationContext(input: {
  organizationId: string;
  channel: string;
  threadId: string;
  facts: ConciergeFactMap;
  flow: ConciergeConversationFlowState;
  /** Required by fact-memory upsert; pass prior recent or []. */
  recent?: ConciergeRecentSnippet[];
  propertyId?: string | null;
  reservationId?: string | null;
}): Promise<void> {
  const prior = await loadConciergeThreadMemory({
    organizationId: input.organizationId,
    channel: input.channel,
    threadId: input.threadId,
  });
  await saveConciergeThreadMemory({
    organizationId: input.organizationId,
    channel: input.channel,
    threadId: input.threadId,
    facts: input.facts,
    flow: input.flow,
    recent: input.recent ?? prior.recent,
    propertyId: input.propertyId,
    reservationId: input.reservationId,
  });
}

export type { ConciergeFactMap, ConciergeConversationFlowState };
