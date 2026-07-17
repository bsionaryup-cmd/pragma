import type { ConciergeConversation } from "@/modules/ai-concierge/types/conversation";
import type { ConciergeAgentRun } from "@/modules/ai-concierge/types/run";
import type { ConciergeOperationMode } from "@/modules/ai-concierge/channel/session-store";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { runConciergeTurn } from "@/modules/ai-concierge/engine/orchestrator";
import { createPhase6ReadToolRegistry } from "@/modules/ai-concierge/tools/read/wire";
import {
  getConciergeIntentDefinition,
  renderIntentTemplate,
} from "@/modules/ai-concierge/intent/library";
import { auditConciergeCandidate } from "@/modules/ai-concierge/engine/auditor";
import { recordLearningProposal } from "@/modules/ai-concierge/learning/proposals";
import { recordConciergeTurnMetric } from "@/modules/ai-concierge/engine/metrics";

function extractFactsFromToolData(
  data: unknown,
): Record<string, string | number | boolean | null> {
  if (!data || typeof data !== "object") return {};
  const row = data as Record<string, unknown>;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(row)) {
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

export type ConciergeComposeResult = {
  conversation: ConciergeConversation;
  run: ConciergeAgentRun;
  suggestedReply: string | null;
  autoEligible: boolean;
  mayAutoSend: boolean;
  mode: ConciergeOperationMode;
  usedLlm: false;
  learningRecorded: boolean;
};

/**
 * Compone respuesta: L1/L2 + tools lectura. Nunca invoca OpenAI.
 */
export async function composeConciergeReply(input: {
  conversation: ConciergeConversation;
  guestMessage: string;
  scope: TenantDataScope;
  mode: ConciergeOperationMode;
  knownFacts?: Record<string, string | number | boolean | null>;
  externalMessageId?: string | null;
}): Promise<ConciergeComposeResult> {
  const registry = createPhase6ReadToolRegistry({
    scope: input.scope,
    conversationId: input.conversation.id,
  });

  let knownFacts = { ...(input.knownFacts ?? {}) };

  const { conversation, run } = await runConciergeTurn({
    conversation: input.conversation,
    guestMessage: input.guestMessage,
    knownFacts,
    currentPhase: 6,
    toolRegistry: registry,
    externalMessageId: input.externalMessageId,
  });

  if (run.decision.path === "needs_tools") {
    for (const inv of run.toolInvocations) {
      if (inv.status === "executed" && inv.result?.ok && inv.result.data) {
        knownFacts = {
          ...knownFacts,
          ...extractFactsFromToolData(inv.result.data),
        };
      }
    }
    const def = getConciergeIntentDefinition(run.intent.intent);
    const missing = def.requiredFacts.filter((key) => {
      const v = knownFacts[key];
      return v === null || v === undefined || v === "";
    });
    run.context.knownFacts = knownFacts;
    run.context.missingFacts = missing;
    if (missing.length === 0 && def.template.trim()) {
      const rendered = renderIntentTemplate(def.template, knownFacts);
      const auditor = auditConciergeCandidate({
        draft: rendered.text,
        knownFacts,
        requiredFacts: def.requiredFacts,
      });
      run.auditor = auditor;
      if (auditor.verified) {
        run.decision = {
          path: "deterministic",
          reason: "Hechos obtenidos vía tools de lectura",
          draftResponse: rendered.text,
          requiredToolNames: def.suggestedReadTools,
        };
      }
    }
  }

  const def = getConciergeIntentDefinition(run.intent.intent);
  let suggestedReply =
    input.mode === "observe" ? null : run.decision.draftResponse;

  if (
    !suggestedReply &&
    input.mode !== "observe" &&
    (run.decision.path === "needs_tools" ||
      run.context.missingFacts.length > 0)
  ) {
    const missing = run.context.missingFacts;
    suggestedReply =
      missing.length > 0
        ? `Para ayudarte necesito confirmar: ${missing.join(", ")}. ¿Me das más detalles?`
        : null;
  }

  let learningRecorded = false;
  if (run.decision.path === "needs_llm" || run.intent.intent === "OTHER") {
    recordLearningProposal({
      question: input.guestMessage,
      intent: run.intent.intent,
      reason: run.decision.reason,
      organizationId: input.conversation.organizationId,
    });
    learningRecorded = true;
    if (input.mode !== "observe" && !suggestedReply) {
      suggestedReply =
        "Voy a escalar tu consulta con el equipo para darte una respuesta precisa. ¿Puedes confirmar el detalle de lo que necesitas?";
    }
  }

  if (run.decision.path === "escalate" && input.mode !== "observe") {
    suggestedReply =
      suggestedReply ??
      "Gracias por avisarnos. Un administrador revisará tu caso de inmediato.";
  }

  const autoEligible =
    run.decision.path === "deterministic" &&
    run.auditor.verified &&
    Boolean(suggestedReply) &&
    def.complexity === "low" &&
    !def.alwaysEscalate;

  const mayAutoSend =
    input.mode === "autonomous" && autoEligible && Boolean(suggestedReply);

  recordConciergeTurnMetric(run.decision.path);

  return {
    conversation,
    run,
    suggestedReply,
    autoEligible,
    mayAutoSend,
    mode: input.mode,
    usedLlm: false,
    learningRecorded,
  };
}
