/**
 * Intent-aware Context Engine — uses existing read tools only.
 * Never invents facts. Never duplicates tool calls already satisfied.
 */
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import type { ConciergeConversation } from "@/modules/ai-concierge/types/conversation";
import type { ConciergeIntent } from "@/modules/ai-concierge/types/intent";
import type { ConciergeContextSnapshot } from "@/modules/ai-concierge/types/context";
import { getConciergeIntentDefinition } from "@/modules/ai-concierge/intent/library";
import { createPhase6ReadToolRegistry } from "@/modules/ai-concierge/tools/read/wire";
import type { ConciergeFactMap } from "@/modules/ai-concierge/memory/fact-memory";
import type { ConciergeConversationFlowState } from "@/modules/ai-concierge/memory/fact-memory";
import type { ConciergeRecentSnippet } from "@/modules/ai-concierge/memory/fact-memory";
import { selectToolsForIntent } from "@/modules/ai-concierge/context/tool-selection";

export { selectToolsForIntent } from "@/modules/ai-concierge/context/tool-selection";

export type ConciergeBuiltContext = ConciergeContextSnapshot & {
  flow: ConciergeConversationFlowState;
  toolsUsed: string[];
  /** Guest+agent snippets for follow-up / L3 grounding (additive). */
  recentDialogue: Array<{ role: "guest" | "agent" | "system"; body: string }>;
  tokenHint: {
    intent: ConciergeIntent;
    factKeys: string[];
    recentCount: number;
  };
};

function extractFactsFromToolData(
  data: unknown,
): ConciergeFactMap {
  if (!data || typeof data !== "object") return {};
  const row = data as Record<string, unknown>;
  const out: ConciergeFactMap = {};
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

export async function buildIntentAwareContext(input: {
  conversation: ConciergeConversation;
  intent: ConciergeIntent;
  scope: TenantDataScope;
  knownFacts: ConciergeFactMap;
  flow: ConciergeConversationFlowState;
  recent: ConciergeRecentSnippet[];
  allowedPropertyIds?: string[];
  allowedTools?: string[];
}): Promise<ConciergeBuiltContext> {
  const def = getConciergeIntentDefinition(input.intent);
  let knownFacts = { ...input.knownFacts };
  const toolsUsed: string[] = [];

  const toolNames = selectToolsForIntent(input.intent, knownFacts);
  if (toolNames.length > 0) {
    const registry = createPhase6ReadToolRegistry({
      scope: input.scope,
      conversationId: input.conversation.id,
      allowedPropertyIds: input.allowedPropertyIds,
      allowedTools: input.allowedTools,
    });

    for (const toolName of toolNames) {
      const inv = await registry.invoke({
        toolName,
        args: {
          organizationId: input.conversation.organizationId,
          propertyId: input.conversation.propertyId,
          reservationId: input.conversation.reservationId,
        },
        currentPhase: 6,
      });
      toolsUsed.push(toolName);
      if (inv.status === "executed" && inv.result?.ok && inv.result.data) {
        knownFacts = {
          ...knownFacts,
          ...extractFactsFromToolData(inv.result.data),
        };
      }
    }
  }

  const missingFacts = def.requiredFacts.filter((key) => {
    const v = knownFacts[key];
    return v === null || v === undefined || v === "";
  });

  const recentGuestMessages = input.recent
    .filter((m) => m.role === "guest")
    .slice(-8)
    .map((m) => m.body);

  for (const msg of input.conversation.messages) {
    if (msg.role === "guest" && msg.body.trim()) {
      recentGuestMessages.push(msg.body);
    }
  }

  const dedupedRecent = [...new Set(recentGuestMessages)].slice(-8);

  const recentDialogue = input.recent
    .filter((m) => m.role === "guest" || m.role === "agent")
    .slice(-10)
    .map((m) => ({ role: m.role, body: m.body.slice(0, 280) }));

  return {
    organizationId: input.conversation.organizationId,
    propertyId: input.conversation.propertyId ?? null,
    reservationId: input.conversation.reservationId ?? null,
    knownFacts,
    missingFacts,
    recentGuestMessages: dedupedRecent,
    builtAt: new Date().toISOString(),
    flow: input.flow,
    toolsUsed,
    recentDialogue,
    tokenHint: {
      intent: input.intent,
      factKeys: Object.keys(knownFacts),
      recentCount: dedupedRecent.length,
    },
  };
}

export function formatContextForLlm(context: ConciergeBuiltContext): string {
  const lines: string[] = [
    `organizationId=${context.organizationId}`,
    `propertyId=${context.propertyId ?? "null"}`,
    `reservationId=${context.reservationId ?? "null"}`,
    `topic=${context.flow.topic ?? "null"}`,
    `flow=${context.flow.flow ?? "null"}`,
    `pendingAction=${context.flow.pendingAction ?? "null"}`,
    "knownFacts:",
  ];
  for (const [k, v] of Object.entries(context.knownFacts)) {
    lines.push(`  ${k}=${v === null ? "null" : String(v)}`);
  }
  if (context.missingFacts.length) {
    lines.push(`missingFacts=${context.missingFacts.join(",")}`);
  }
  if (context.recentDialogue?.length) {
    lines.push("recentDialogue:");
    for (const m of context.recentDialogue) {
      lines.push(`  ${m.role}: ${m.body}`);
    }
  } else if (context.recentGuestMessages.length) {
    lines.push("recentGuestMessages:");
    for (const m of context.recentGuestMessages) {
      lines.push(`  - ${m.slice(0, 280)}`);
    }
  }
  return lines.join("\n");
}
