/**
 * Deterministic acknowledgements — no LLM, no tools.
 * Variants via conversational-guards (humanization v1.1).
 */
import {
  evaluateNoReplyPolicy,
  humanizeDeterministicAck,
  isPureAckMessage,
} from "@/modules/ai-concierge/engine/conversational-guards";
import type { ConciergeConversationFlowState } from "@/modules/ai-concierge/memory/fact-memory";
import type { ConciergeRecentSnippet } from "@/modules/ai-concierge/memory/fact-memory";

export { isPureAckMessage };

export function matchDeterministicAck(
  message: string,
  options?: { salt?: string },
): string | null {
  return humanizeDeterministicAck(message, options?.salt ?? message);
}

/**
 * Ack path with no-reply / soft-continue awareness (reuses flow memory).
 */
export function matchContextualAck(input: {
  guestMessage: string;
  flow: ConciergeConversationFlowState;
  recent: ConciergeRecentSnippet[];
  salt?: string;
}): { reply: string | null; silence: boolean; reason: string | null } {
  const policy = evaluateNoReplyPolicy({
    guestMessage: input.guestMessage,
    flow: input.flow,
    recent: input.recent,
  });
  if (policy.silence) {
    return { reply: null, silence: true, reason: policy.reason };
  }
  if (policy.softContinue) {
    return {
      reply: policy.softContinue,
      silence: false,
      reason: policy.reason,
    };
  }
  const ack = matchDeterministicAck(input.guestMessage, {
    salt: input.salt ?? input.guestMessage,
  });
  return { reply: ack, silence: false, reason: null };
}
