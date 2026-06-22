import "server-only";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

export function isOpenAiEnrichmentConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getEnrichmentModel(): string {
  return process.env.SALES_ENRICHMENT_MODEL?.trim() || "gpt-4o-mini";
}

export async function callOpenAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Configura OPENAI_API_KEY para habilitar el asistente comercial.",
    );
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
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
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail
        ? `OpenAI respondió con error (${response.status})`
        : `OpenAI respondió con error (${response.status})`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const raw = payload.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OpenAI no devolvió contenido");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("OpenAI devolvió JSON inválido");
  }
}
