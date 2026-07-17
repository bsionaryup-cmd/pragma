import type {
  ConciergeChannel,
  ConciergeConversation,
  ConciergeMessage,
  ConciergeMessageRole,
} from "@/modules/ai-concierge/types/conversation";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createConversationMemory(input: {
  organizationId: string;
  channel: ConciergeChannel;
  propertyId?: string | null;
  reservationId?: string | null;
  guestLabel?: string | null;
}): ConciergeConversation {
  const at = nowIso();
  return {
    id: newId("conv"),
    organizationId: input.organizationId,
    propertyId: input.propertyId ?? null,
    reservationId: input.reservationId ?? null,
    channel: input.channel,
    guestLabel: input.guestLabel ?? null,
    messages: [],
    createdAt: at,
    updatedAt: at,
  };
}

export function appendMessage(
  conversation: ConciergeConversation,
  input: {
    role: ConciergeMessageRole;
    body: string;
    channel?: ConciergeChannel;
    externalMessageId?: string | null;
  },
): { conversation: ConciergeConversation; message: ConciergeMessage } {
  const message: ConciergeMessage = {
    id: newId("msg"),
    conversationId: conversation.id,
    role: input.role,
    body: input.body,
    channel: input.channel ?? conversation.channel,
    externalMessageId: input.externalMessageId ?? null,
    createdAt: nowIso(),
  };
  const next: ConciergeConversation = {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: message.createdAt,
  };
  return { conversation: next, message };
}

export function getRecentMessages(
  conversation: ConciergeConversation,
  limit = 10,
): ConciergeMessage[] {
  if (limit <= 0) return [];
  return conversation.messages.slice(-limit);
}
