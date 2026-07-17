/**
 * Auditor de respuestas: verifica que el draft no invente hechos.
 * Fase 5: se ejecuta sobre drafts internos; NUNCA implica envío.
 */
export function auditConciergeCandidate(input: {
  draft: string | null;
  knownFacts: Record<string, string | number | boolean | null>;
  requiredFacts: string[];
}): { verified: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!input.draft || !input.draft.trim()) {
    return { verified: false, issues: ["Sin draft que auditar"] };
  }

  for (const key of input.requiredFacts) {
    const value = input.knownFacts[key];
    if (value === null || value === undefined || value === "") {
      issues.push(`Falta hecho requerido: ${key}`);
      continue;
    }
    const needle = String(value).trim();
    if (needle && !input.draft.includes(needle)) {
      issues.push(`Draft no contiene el hecho verificado: ${key}`);
    }
  }

  // Marcadores sin resolver = no grounded
  const unresolved = input.draft.match(/\{\{(\w+)\}\}/g);
  if (unresolved?.length) {
    issues.push(`Placeholders sin resolver: ${unresolved.join(", ")}`);
  }

  return { verified: issues.length === 0, issues };
}
