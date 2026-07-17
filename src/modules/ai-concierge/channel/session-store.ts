import type { ConciergeChannel, ConciergeConversation } from "@/modules/ai-concierge/types/conversation";
import type { ConciergeAgentRun } from "@/modules/ai-concierge/types/run";

export type ConciergeOperationMode =
  | "observe" // F7
  | "manual" // F8
  | "assisted" // F9
  | "autonomous"; // F12

type StoredSession = {
  conversation: ConciergeConversation;
  runs: ConciergeAgentRun[];
  updatedAt: string;
};

const sessions = new Map<string, StoredSession>();

function sessionKey(input: {
  organizationId: string;
  channel: ConciergeChannel;
  threadId: string;
}): string {
  return `${input.organizationId}::${input.channel}::${input.threadId}`;
}

export function getOrCreateChannelSession(input: {
  organizationId: string;
  channel: ConciergeChannel;
  threadId: string;
  propertyId?: string | null;
  reservationId?: string | null;
  guestLabel?: string | null;
}): ConciergeConversation {
  const key = sessionKey(input);
  const existing = sessions.get(key);
  if (existing) {
    const conv = {
      ...existing.conversation,
      propertyId: input.propertyId ?? existing.conversation.propertyId,
      reservationId: input.reservationId ?? existing.conversation.reservationId,
      guestLabel: input.guestLabel ?? existing.conversation.guestLabel,
    };
    existing.conversation = conv;
    existing.updatedAt = new Date().toISOString();
    return conv;
  }
  const at = new Date().toISOString();
  const conversation: ConciergeConversation = {
    id: `conv_${key.slice(0, 24)}_${Date.now().toString(36)}`,
    organizationId: input.organizationId,
    propertyId: input.propertyId ?? null,
    reservationId: input.reservationId ?? null,
    channel: input.channel,
    guestLabel: input.guestLabel ?? null,
    messages: [],
    createdAt: at,
    updatedAt: at,
  };
  sessions.set(key, { conversation, runs: [], updatedAt: at });
  return conversation;
}

export function saveChannelSession(input: {
  organizationId: string;
  channel: ConciergeChannel;
  threadId: string;
  conversation: ConciergeConversation;
  run?: ConciergeAgentRun;
}): void {
  const key = sessionKey(input);
  const prev = sessions.get(key);
  const runs = prev?.runs ?? [];
  if (input.run) runs.push(input.run);
  sessions.set(key, {
    conversation: input.conversation,
    runs: runs.slice(-50),
    updatedAt: new Date().toISOString(),
  });
}

export function listChannelSessionSummaries(organizationId: string) {
  const out = [];
  for (const [key, value] of sessions) {
    if (!key.startsWith(`${organizationId}::`)) continue;
    out.push({
      key,
      conversationId: value.conversation.id,
      channel: value.conversation.channel,
      messageCount: value.conversation.messages.length,
      runCount: value.runs.length,
      updatedAt: value.updatedAt,
    });
  }
  return out;
}
