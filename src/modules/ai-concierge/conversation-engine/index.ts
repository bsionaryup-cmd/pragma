/**
 * Conversation Engine (facade) — rule-based / state-driven WhatsApp workflows.
 *
 * Lives inside ai-concierge (NOT packages/) to avoid a second Concierge brain.
 * See docs/audits/CONVERSATION-ENGINE-PHASE1-ARCHITECTURE-AUDIT.md
 */
export * from "@/modules/ai-concierge/conversation-engine/types";
export * from "@/modules/ai-concierge/conversation-engine/workflow-registry";
export * from "@/modules/ai-concierge/conversation-engine/intent-router";
export * from "@/modules/ai-concierge/conversation-engine/message-renderer";
export * from "@/modules/ai-concierge/conversation-engine/validators";
export * from "@/modules/ai-concierge/conversation-engine/workflow-engine";
export * from "@/modules/ai-concierge/conversation-engine/escalation";
export {
  loadConversationSession,
  persistConversationContext,
} from "@/modules/ai-concierge/conversation-engine/conversation-manager";

/** Reservation adapter is server-only — import from reservation-adapter.ts directly. */
