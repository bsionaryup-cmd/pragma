import "server-only";

import { OpenAiEnrichmentError } from "@/modules/sales-console/enrichment/enrichment.errors";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 15_000;

export function isOpenAiEnrichmentConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getEnrichmentModel(): string {
  return process.env.SALES_ENRICHMENT_MODEL?.trim() || "gpt-4o-mini";
}

function isRetryableOpenAiStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function requestOpenAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAiEnrichmentError(
      "Configura OPENAI_API_KEY para habilitar el asistente comercial.",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getEnrichmentModel(),
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 429 ||
        isRetryableOpenAiStatus(response.status)
      ) {
        throw new OpenAiEnrichmentError();
      }
      throw new OpenAiEnrichmentError();
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw = payload.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new OpenAiEnrichmentError();
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new OpenAiEnrichmentError();
    }
  } catch (error) {
    if (error instanceof OpenAiEnrichmentError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenAiEnrichmentError();
    }
    throw new OpenAiEnrichmentError();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callOpenAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  try {
    return await requestOpenAiJson<T>(systemPrompt, userPrompt);
  } catch (error) {
    if (!(error instanceof OpenAiEnrichmentError)) {
      throw error;
    }

    return requestOpenAiJson<T>(systemPrompt, userPrompt);
  }
}
