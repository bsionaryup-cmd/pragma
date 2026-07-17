import type { ConciergeIntentDetection } from "@/modules/ai-concierge/types/intent";
import type { ConciergeContextSnapshot } from "@/modules/ai-concierge/types/context";
import type { ConciergeToolInvocationRecord } from "@/modules/ai-concierge/types/tool";

export type ConciergeResolutionPath =
  | "deterministic"
  | "needs_tools"
  | "needs_llm"
  | "escalate"
  | "blocked_outbound";

export type ConciergeRunDecision = {
  path: ConciergeResolutionPath;
  reason: string;
  /** Draft interno — NUNCA se envía en Fase 5. */
  draftResponse: string | null;
  requiredToolNames: string[];
};

export type ConciergeAgentRun = {
  id: string;
  conversationId: string;
  organizationId: string;
  inboundMessageId: string;
  intent: ConciergeIntentDetection;
  context: ConciergeContextSnapshot;
  decision: ConciergeRunDecision;
  toolInvocations: ConciergeToolInvocationRecord[];
  /** Auditor de respuesta (si hubo draft). */
  auditor: {
    verified: boolean;
    issues: string[];
  };
  /** Hard gate Fase 5. */
  outboundBlocked: true;
  createdAt: string;
};
