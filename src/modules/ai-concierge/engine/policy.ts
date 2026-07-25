import type { ConciergeIntent } from "@/modules/ai-concierge/types/intent";
import { getConciergeIntentDefinition } from "@/modules/ai-concierge/intent/library";

export const ALWAYS_ESCALATE_INTENTS: ReadonlySet<ConciergeIntent> = new Set([
  "EMERGENCY",
  "COMPLAINT",
  "REFUND",
  "DISCOUNT",
]);

export type ConciergePolicyVerdict =
  | { action: "escalate"; reason: string }
  | { action: "deterministic"; reason: string }
  | { action: "needs_tools"; reason: string; toolNames: string[] }
  | { action: "needs_llm"; reason: string };

/**
 * Política híbrida L1/L2. LLM solo si ambiguo (OTHER) o complejidad alta sin facts.
 * Nunca autoriza outbound en Fase 5 (eso lo fuerza el orchestrator).
 */
export function evaluateConciergePolicy(input: {
  intent: ConciergeIntent;
  confidence: number;
  missingRequiredFacts: string[];
}): ConciergePolicyVerdict {
  const def = getConciergeIntentDefinition(input.intent);

  if (def.alwaysEscalate || ALWAYS_ESCALATE_INTENTS.has(input.intent)) {
    return {
      action: "escalate",
      reason: `Intención ${input.intent} requiere intervención humana`,
    };
  }

  if (input.intent === "OTHER" || input.confidence < 0.55) {
    return {
      action: "needs_llm",
      reason: "Ambigüedad / confianza baja — requiere L3 con Context Engine",
    };
  }

  if (input.missingRequiredFacts.length > 0) {
    return {
      action: "needs_tools",
      reason: `Faltan hechos: ${input.missingRequiredFacts.join(", ")}`,
      toolNames: def.suggestedReadTools,
    };
  }

  if (!def.template.trim()) {
    return {
      action: "needs_llm",
      reason: "Sin plantilla determinística — requiere L3 grounded",
    };
  }

  return {
    action: "deterministic",
    reason: "Intención clara y hechos completos — motor L1",
  };
}
