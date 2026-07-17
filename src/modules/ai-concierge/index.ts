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

export {
  runConciergeTurn,
  type ConciergeTurnInput,
} from "@/modules/ai-concierge/engine/orchestrator";
