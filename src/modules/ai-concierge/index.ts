/**
 * PRAGMA AI Concierge — Fase 5 foundation (+ exports seguros sin server-only).
 * Handlers de lectura Fase 6: importar desde
 * `@/modules/ai-concierge/tools/read/wire` (server-only).
 */
export type {
  ConciergeChannel,
  ConciergeConversation,
  ConciergeMessage,
  ConciergeMessageRole,
} from "@/modules/ai-concierge/types/conversation";
export type {
  ConciergeIntent,
  ConciergeIntentDetection,
  ConciergeIntentDefinition,
} from "@/modules/ai-concierge/types/intent";
export type {
  ConciergeToolDefinition,
  ConciergeToolInvocationRecord,
  ConciergeToolResult,
} from "@/modules/ai-concierge/types/tool";
export type {
  ConciergeAgentRun,
  ConciergeResolutionPath,
  ConciergeRunDecision,
} from "@/modules/ai-concierge/types/run";
export type { ConciergeContextSnapshot } from "@/modules/ai-concierge/types/context";

export {
  CONCIERGE_INTENTS,
  getConciergeIntentDefinition,
  listConciergeIntentDefinitions,
} from "@/modules/ai-concierge/intent/library";
export { detectConciergeIntent } from "@/modules/ai-concierge/intent/detect";
export {
  GUEST_UTTERANCE_BANK,
  matchGuestUtterance,
  utteranceBankStats,
} from "@/modules/ai-concierge/intent/utterance-bank";
export {
  humanClarifyMissingFacts,
  sanitizeGuestOutbound,
  guestCopyLooksUnsafe,
} from "@/modules/ai-concierge/engine/guest-copy";

/** Conversation Engine facade (rule-based workflows; no LLM). */
export {
  RESERVATION_WORKFLOW_STEPS,
  WORKFLOW_REGISTRY_IDS,
  getWorkflowDefinition,
  listRegisteredWorkflows,
  routeGuestIntent,
  mapPendingActionToStep,
  renderReservationStepPrompt,
  assertReservationStepMachineComplete,
} from "@/modules/ai-concierge/conversation-engine";

/** Hospitality Protocol Engine v3.0 */
export {
  listHospitalityProtocols,
  protocolFromWorkflowId,
  protocolFromPendingAction,
  buildVirtualReceptionistWelcome,
  buildWelcomeAskNameMessage,
  buildPostNameMenuMessage,
} from "@/modules/ai-concierge/hospitality-protocols";

export {
  createConversationMemory,
  appendMessage,
  getRecentMessages,
} from "@/modules/ai-concierge/memory/conversation-memory";

export { buildConciergeContext } from "@/modules/ai-concierge/context/build-context";

export {
  createToolRegistry,
  type ConciergeToolRegistry,
} from "@/modules/ai-concierge/tools/registry";

export {
  evaluateConciergePolicy,
  ALWAYS_ESCALATE_INTENTS,
} from "@/modules/ai-concierge/engine/policy";

export { auditConciergeCandidate } from "@/modules/ai-concierge/engine/auditor";

export { matchDeterministicAck } from "@/modules/ai-concierge/engine/deterministic-ack";

export {
  runConciergeTurn,
  type ConciergeTurnInput,
} from "@/modules/ai-concierge/engine/orchestrator";
