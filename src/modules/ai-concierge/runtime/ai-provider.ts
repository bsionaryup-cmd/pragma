/**
 * AI Provider interface — Concierge never binds to a vendor directly.
 * Providers only generate language; never business rules or DB queries.
 */
import type { ConciergeLlmResult } from "@/modules/ai-concierge/engine/llm";

export type ConciergeAiProviderId = "local" | "openai" | "future";

export type ConciergeAiGenerateInput = {
  systemPrompt?: string;
  contextBlock: string;
  guestMessage: string;
  tenantRules?: string;
};

export type ConciergeAiProvider = {
  id: ConciergeAiProviderId;
  configured: () => boolean;
  generate: (
    input: ConciergeAiGenerateInput,
  ) => Promise<ConciergeLlmResult | null>;
};

export function createLocalAiProvider(): ConciergeAiProvider {
  return {
    id: "local",
    configured: () => true,
    generate: async () => null,
  };
}

export function createOpenAiProvider(deps: {
  call: (input: ConciergeAiGenerateInput) => Promise<ConciergeLlmResult | null>;
  isConfigured: () => boolean;
}): ConciergeAiProvider {
  return {
    id: "openai",
    configured: deps.isConfigured,
    generate: deps.call,
  };
}

let activeProvider: ConciergeAiProvider | null = null;

export function setConciergeAiProvider(provider: ConciergeAiProvider): void {
  activeProvider = provider;
}

export function getConciergeAiProvider(): ConciergeAiProvider {
  if (activeProvider) return activeProvider;
  return createLocalAiProvider();
}

/**
 * Resolve provider from env without leaking vendor into callers.
 * OPENAI_API_KEY → openai; else local (deterministic-only / escalate).
 */
export function resolveDefaultConciergeAiProvider(deps: {
  callOpenAi: (
    input: ConciergeAiGenerateInput,
  ) => Promise<ConciergeLlmResult | null>;
  isOpenAiConfigured: () => boolean;
}): ConciergeAiProvider {
  const forced = process.env.CONCIERGE_AI_PROVIDER?.trim().toLowerCase();
  if (forced === "local") return createLocalAiProvider();
  if (forced === "future") {
    return {
      id: "future",
      configured: () => false,
      generate: async () => null,
    };
  }
  if (deps.isOpenAiConfigured()) {
    return createOpenAiProvider({
      call: deps.callOpenAi,
      isConfigured: deps.isOpenAiConfigured,
    });
  }
  return createLocalAiProvider();
}
