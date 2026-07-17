import type { ConciergeConversation } from "@/modules/ai-concierge/types/conversation";
import type { ConciergeContextSnapshot } from "@/modules/ai-concierge/types/context";
import { getRecentMessages } from "@/modules/ai-concierge/memory/conversation-memory";

/**
 * Construye contexto solo con hechos inyectados (sin Prisma).
 * Fase 6 podrá enriquecer knownFacts vía tools de lectura.
 */
export function buildConciergeContext(input: {
  conversation: ConciergeConversation;
  knownFacts?: Record<string, string | number | boolean | null>;
  missingFacts?: string[];
}): ConciergeContextSnapshot {
  const recent = getRecentMessages(input.conversation, 8)
    .filter((m) => m.role === "guest")
    .map((m) => m.body);

  return {
    organizationId: input.conversation.organizationId,
    propertyId: input.conversation.propertyId ?? null,
    reservationId: input.conversation.reservationId ?? null,
    knownFacts: { ...(input.knownFacts ?? {}) },
    missingFacts: [...(input.missingFacts ?? [])],
    recentGuestMessages: recent,
    builtAt: new Date().toISOString(),
  };
}
