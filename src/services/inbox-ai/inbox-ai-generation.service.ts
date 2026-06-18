import type { InboxAiContext } from "@/services/inbox-ai/inbox-context.types";
import {
  formatConversationThreadForPrompt,
  formatInboxAiContextForPrompt,
  formatKnowledgeForPrompt,
  sliceGuestMessagesForReply,
} from "@/services/inbox-ai/inbox-context.format";
import type { InboxAiIntent } from "@/services/inbox-ai/inbox-intent.types";
import { inboxIntentLabel } from "@/services/inbox-ai/inbox-intent.service";

const SYSTEM_PROMPT = `Eres un asistente de hospitalidad para anfitriones de alquiler vacacional en Colombia.
REGLAS ESTRICTAS:
- Lee el hilo de conversación completo antes de redactar.
- Responde de forma directa y natural al mensaje marcado como objetivo, teniendo en cuenta lo que el huésped dijo antes.
- Usa ÚNICAMENTE los hechos listados en el contexto confirmado.
- Si falta información en "Información NO disponible", di que confirmarás con el equipo y NO inventes datos.
- No repitas información genérica de check-in si el huésped pregunta otra cosa (disponibilidad, fechas, etc.).
- Tono cálido, profesional, en español (Colombia).
- Respuesta lista para enviar al huésped por Airbnb (texto plano, sin markdown).
- Máximo 120 palabras.`;

export type InboxAiGenerationProvider = "openai" | "template";

export type InboxAiGenerationResult = {
  text: string;
  provider: InboxAiGenerationProvider;
  model: string | null;
};

function truncateForReply(text: string, max = 100): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function buildContextualTemplateReply(input: {
  context: InboxAiContext;
  guestMessageBody: string;
  intent: InboxAiIntent;
  priorMessages: Array<{ body: string }>;
}): string {
  const guestName =
    input.context.reservation.guestName.split(/\s+/)[0] || "huésped";
  const facts = input.context.knowledge.sections;
  const question = input.guestMessageBody.trim().toLowerCase();
  const lines: string[] = [];

  if (input.priorMessages.length > 0) {
    lines.push(`Hola ${guestName}, gracias por tu mensaje.`);
  } else {
    lines.push(`Hola ${guestName}, gracias por escribir.`);
  }

  if (input.intent === "WIFI") {
    const wifiSection = facts.find((section) => section.type === "WIFI");
    if (wifiSection) {
      lines.push(`Sobre el WiFi: ${wifiSection.body}.`);
    } else if (input.context.knownFacts.wifiName) {
      const password = input.context.knownFacts.wifiPassword
        ? ` y la clave es ${input.context.knownFacts.wifiPassword}`
        : "";
      lines.push(
        `La red WiFi es ${input.context.knownFacts.wifiName}${password}.`,
      );
    } else {
      lines.push("Te confirmo los datos de WiFi en un momento.");
    }
  } else if (input.intent === "PARKING") {
    lines.push(
      "Sobre parqueadero: te confirmo las opciones más cercanas en un momento.",
    );
  } else if (input.intent === "ACCESS" && input.context.knownFacts.accessCode) {
    lines.push(`El código de acceso es ${input.context.knownFacts.accessCode}.`);
    if (input.context.knownFacts.accessInstructions) {
      lines.push(input.context.knownFacts.accessInstructions);
    }
  } else if (input.intent === "LOCATION" && input.context.knownFacts.propertyAddress) {
    lines.push(`La dirección es ${input.context.knownFacts.propertyAddress}.`);
  } else if (input.intent === "PAYMENT") {
    lines.push("Revisaré el detalle del pago de tu reserva y te confirmo.");
  } else if (/disponib|21 al 23|fechas|extender|adelant|antes de|otra fecha/i.test(question)) {
    lines.push(
      "Sobre la disponibilidad que mencionas: revisaré el calendario para esas fechas y te confirmo en breve.",
    );
  } else if (/check.?in|llegada|entrada|hora/i.test(question)) {
    const time = input.context.knownFacts.checkInTime;
    lines.push(
      time
        ? `El check-in es desde las ${time}.`
        : "Te confirmo la hora de check-in en un momento.",
    );
  } else if (/check.?out|salida/i.test(question)) {
    const time = input.context.knownFacts.checkOutTime;
    lines.push(
      time
        ? `El check-out es hasta las ${time}.`
        : "Te confirmo la hora de check-out en un momento.",
    );
  } else if (/agua caliente|calentador|ducha/i.test(question)) {
    lines.push(
      "Lamento el inconveniente con el agua caliente. Lo reviso de inmediato con el equipo y te confirmo.",
    );
  } else if (/reglas|fumar|mascota|ruido/i.test(question)) {
    if (input.context.knownFacts.houseRules) {
      lines.push(`Las reglas de la casa son: ${input.context.knownFacts.houseRules}`);
    } else {
      lines.push("Te comparto las reglas de la casa en un momento.");
    }
  } else {
    const snippet = truncateForReply(input.guestMessageBody);
    lines.push(
      `Sobre tu consulta ("${snippet}"): lo reviso con el equipo y te respondo en breve.`,
    );
  }

  if (input.context.missingFacts.length > 0) {
    lines.push("Si necesitas algo más, con gusto te ayudamos.");
  }

  if (input.context.knownFacts.receptionWhatsapp) {
    lines.push(
      `También puedes escribirnos al ${input.context.knownFacts.receptionWhatsapp}.`,
    );
  }

  return lines.join("\n\n");
}

export async function generateInboxAiDraftText(input: {
  context: InboxAiContext;
  guestMessageId?: string | null;
  guestMessageBody: string;
  intent: InboxAiIntent;
}): Promise<InboxAiGenerationResult> {
  const conversation = sliceGuestMessagesForReply(input.context.guestMessages, {
    id: input.guestMessageId,
    body: input.guestMessageBody,
  });

  const priorMessages = conversation?.priorMessages ?? [];
  const targetBody = conversation?.targetMessage.body ?? input.guestMessageBody;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.INBOX_AI_MODEL?.trim() || "gpt-4o-mini";

  if (!apiKey) {
    return {
      text: buildContextualTemplateReply({
        context: input.context,
        guestMessageBody: targetBody,
        intent: input.intent,
        priorMessages,
      }),
      provider: "template",
      model: null,
    };
  }

  const contextBlock = formatInboxAiContextForPrompt({
    stayStage: input.context.stayStage,
    knownFacts: input.context.knownFacts,
    missingFacts: input.context.missingFacts,
    guestMessages: conversation?.threadMessages ?? input.context.guestMessages,
    activityHistory: input.context.activityHistory.slice(-8),
  });

  const conversationBlock = conversation
    ? formatConversationThreadForPrompt(conversation)
    : `Mensaje del huésped:\n"""${targetBody.trim()}"""`;

  const knowledgeBlock = formatKnowledgeForPrompt(input.context.knowledge.sections);

  const userPrompt = `Intención detectada: ${inboxIntentLabel(input.intent)} (${input.intent})

${conversationBlock}

${knowledgeBlock ? `${knowledgeBlock}\n\n` : ""}Contexto operativo:
${contextBlock}

Redacta una respuesta conversacional para el huésped, respondiendo al mensaje marcado como objetivo.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      return {
        text: buildContextualTemplateReply({
          context: input.context,
          guestMessageBody: targetBody,
          intent: input.intent,
          priorMessages,
        }),
        provider: "template",
        model: null,
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return {
        text: buildContextualTemplateReply({
          context: input.context,
          guestMessageBody: targetBody,
          intent: input.intent,
          priorMessages,
        }),
        provider: "template",
        model: null,
      };
    }

    return { text, provider: "openai", model };
  } catch {
    return {
      text: buildContextualTemplateReply({
        context: input.context,
        guestMessageBody: targetBody,
        intent: input.intent,
        priorMessages,
      }),
      provider: "template",
      model: null,
    };
  }
}
