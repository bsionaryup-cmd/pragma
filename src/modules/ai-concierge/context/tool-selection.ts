/**
 * Pure tool selection — no server-only imports.
 */
import type { ConciergeIntent } from "@/modules/ai-concierge/types/intent";
import { getConciergeIntentDefinition } from "@/modules/ai-concierge/intent/library";
import type { ConciergeFactMap } from "@/modules/ai-concierge/memory/fact-memory";

/** Tools to run for an intent — only when required facts are missing. */
export function selectToolsForIntent(
  intent: ConciergeIntent,
  knownFacts: ConciergeFactMap,
): string[] {
  const def = getConciergeIntentDefinition(intent);
  const missing = def.requiredFacts.filter((key) => {
    const v = knownFacts[key];
    return v === null || v === undefined || v === "";
  });
  if (missing.length === 0) return [];
  return [...def.suggestedReadTools];
}
