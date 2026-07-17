import type { ConciergeConversation } from "@/modules/ai-concierge/types/conversation";
import type { ConciergeAgentRun } from "@/modules/ai-concierge/types/run";
import type { ConciergeToolRegistry } from "@/modules/ai-concierge/tools/registry";
import { detectConciergeIntent } from "@/modules/ai-concierge/intent/detect";
import {
  getConciergeIntentDefinition,
  renderIntentTemplate,
} from "@/modules/ai-concierge/intent/library";
import { buildConciergeContext } from "@/modules/ai-concierge/context/build-context";
import { appendMessage } from "@/modules/ai-concierge/memory/conversation-memory";
import { evaluateConciergePolicy } from "@/modules/ai-concierge/engine/policy";
import { auditConciergeCandidate } from "@/modules/ai-concierge/engine/auditor";
import { createToolRegistry } from "@/modules/ai-concierge/tools/registry";

export type ConciergeTurnInput = {
  conversation: ConciergeConversation;
  guestMessage: string;
  knownFacts?: Record<string, string | number | boolean | null>;
  missingFacts?: string[];
  /** Fase de producto actual (5 = foundation). */
  currentPhase?: number;
  toolRegistry?: ConciergeToolRegistry;
  externalMessageId?: string | null;
};

function newRunId(): string {
  return `run_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

/**
 * Un turno del motor. Registra memoria + decisión + tools planeadas.
 * No envía mensajes. No llama OpenAI.
 */
export async function runConciergeTurn(
  input: ConciergeTurnInput,
): Promise<{
  conversation: ConciergeConversation;
  run: ConciergeAgentRun;
}> {
  const currentPhase = input.currentPhase ?? 5;
  const registry = input.toolRegistry ?? createToolRegistry();

  const { conversation, message } = appendMessage(input.conversation, {
    role: "guest",
    body: input.guestMessage,
    externalMessageId: input.externalMessageId,
  });

  const intent = detectConciergeIntent(input.guestMessage);
  const def = getConciergeIntentDefinition(intent.intent);

  const knownFacts = { ...(input.knownFacts ?? {}) };
  const missingRequired = def.requiredFacts.filter((key) => {
    const v = knownFacts[key];
    return v === null || v === undefined || v === "";
  });

  const context = buildConciergeContext({
    conversation,
    knownFacts,
    missingFacts: [
      ...missingRequired,
      ...(input.missingFacts ?? []).filter((f) => !missingRequired.includes(f)),
    ],
  });

  const policy = evaluateConciergePolicy({
    intent: intent.intent,
    confidence: intent.confidence,
    missingRequiredFacts: missingRequired,
  });

  const toolInvocations = [];
  if (policy.action === "needs_tools") {
    for (const toolName of policy.toolNames) {
      toolInvocations.push(
        await registry.invoke({
          toolName,
          args: {
            organizationId: conversation.organizationId,
            propertyId: conversation.propertyId,
            reservationId: conversation.reservationId,
          },
          currentPhase,
        }),
      );
    }
  }

  let draftResponse: string | null = null;
  let path: ConciergeAgentRun["decision"]["path"] = "blocked_outbound";
  let reason = policy.reason;

  if (policy.action === "escalate") {
    path = "escalate";
  } else if (policy.action === "needs_llm") {
    path = "needs_llm";
  } else if (policy.action === "needs_tools") {
    path = "needs_tools";
  } else if (policy.action === "deterministic") {
    const rendered = renderIntentTemplate(def.template, knownFacts);
    draftResponse = rendered.text;
    path = "deterministic";
    reason = policy.reason;
  }

  const auditor = auditConciergeCandidate({
    draft: draftResponse,
    knownFacts,
    requiredFacts: def.requiredFacts,
  });

  if (draftResponse && !auditor.verified) {
    path = "escalate";
    reason = `Auditor rechazó draft: ${auditor.issues.join("; ")}`;
    draftResponse = null;
  }

  const run: ConciergeAgentRun = {
    id: newRunId(),
    conversationId: conversation.id,
    organizationId: conversation.organizationId,
    inboundMessageId: message.id,
    intent,
    context,
    decision: {
      path,
      reason,
      draftResponse,
      requiredToolNames:
        policy.action === "needs_tools" ? policy.toolNames : def.suggestedReadTools,
    },
    toolInvocations,
    auditor,
    outboundBlocked: true,
    createdAt: new Date().toISOString(),
  };

  return { conversation, run };
}
