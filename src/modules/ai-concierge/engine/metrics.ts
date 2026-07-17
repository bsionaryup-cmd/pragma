export type ConciergeRuntimeMetrics = {
  turnsTotal: number;
  deterministicTurns: number;
  needsToolsTurns: number;
  needsLlmTurns: number;
  escalateTurns: number;
  openaiCalls: number;
  openaiTokens: number;
};

const metrics: ConciergeRuntimeMetrics = {
  turnsTotal: 0,
  deterministicTurns: 0,
  needsToolsTurns: 0,
  needsLlmTurns: 0,
  escalateTurns: 0,
  openaiCalls: 0,
  openaiTokens: 0,
};

export function recordConciergeTurnMetric(path: string): void {
  metrics.turnsTotal += 1;
  if (path === "deterministic") metrics.deterministicTurns += 1;
  else if (path === "needs_tools") metrics.needsToolsTurns += 1;
  else if (path === "needs_llm") metrics.needsLlmTurns += 1;
  else if (path === "escalate") metrics.escalateTurns += 1;
}

/** Reservado: cuando se active L3 OpenAI, incrementar aquí. */
export function recordOpenAiUsage(tokens: number): void {
  metrics.openaiCalls += 1;
  metrics.openaiTokens += Math.max(0, tokens);
}

export function getConciergeRuntimeMetrics(): ConciergeRuntimeMetrics & {
  deterministicRate: number;
  openaiDependencyRate: number;
} {
  const total = Math.max(1, metrics.turnsTotal);
  return {
    ...metrics,
    deterministicRate: metrics.deterministicTurns / total,
    openaiDependencyRate: metrics.openaiCalls / total,
  };
}
