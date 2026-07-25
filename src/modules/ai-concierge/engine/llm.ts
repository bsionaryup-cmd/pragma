import "server-only";

import { recordOpenAiUsage } from "@/modules/ai-concierge/engine/metrics";
import { CONCIERGE_SYSTEM_PROMPT } from "@/modules/ai-concierge/engine/behavior-context";

export { CONCIERGE_SYSTEM_PROMPT } from "@/modules/ai-concierge/engine/behavior-context";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 20_000;

export function isConciergeLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getConciergeLlmModel(): string {
  return (
    process.env.CONCIERGE_LLM_MODEL?.trim() ||
    process.env.SALES_ENRICHMENT_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

export type ConciergeLlmResult = {
  text: string;
  model: string;
  tokens: number;
};

/**
 * L3 LLM for needs_llm path. Returns null when API key missing or call fails.
 */
export async function callConciergeLlm(input: {
  systemPrompt?: string;
  contextBlock: string;
  guestMessage: string;
  tenantRules?: string;
}): Promise<ConciergeLlmResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const system = [
      input.systemPrompt ?? CONCIERGE_SYSTEM_PROMPT,
      input.tenantRules ? `Reglas del tenant:\n${input.tenantRules}` : null,
      "Contexto grounded (única fuente de verdad):\n" + input.contextBlock,
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getConciergeLlmModel(),
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: input.guestMessage },
        ],
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { total_tokens?: number };
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const tokens = Math.max(0, payload.usage?.total_tokens ?? 0);
    recordOpenAiUsage(tokens);

    return {
      text,
      model: getConciergeLlmModel(),
      tokens,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
