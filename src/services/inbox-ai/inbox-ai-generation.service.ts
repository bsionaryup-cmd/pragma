import type { InboxAiContext } from "@/services/inbox-ai/inbox-context.types";
import {
  formatConversationThreadForPrompt,
  formatInboxAiContextForPrompt,
  formatKnowledgeForPrompt,
  formatQuickMessagesForPrompt,
  selectQuickMessageTypesForIntent,
  sliceGuestMessagesForReply,
} from "@/services/inbox-ai/inbox-context.format";
import type { InboxAiIntent } from "@/services/inbox-ai/inbox-intent.types";
import { inboxIntentLabel } from "@/services/inbox-ai/inbox-intent.service";
import { buildQuickMessage } from "@/lib/reservations/quick-messages";

const SYSTEM_PROMPT = `Eres un asistente de hospitalidad para anfitriones de alquiler vacacional en Colombia.
REGLAS ESTRICTAS:
- Lee el hilo completo y responde PRIMERO a la pregunta concreta del huésped (mensaje marcado como objetivo).
- Usa los hechos confirmados, la base de conocimiento y las plantillas operativas del anfitrión.
- Incluye detalles útiles de la propiedad cuando el huésped pregunta por ubicación, acceso, WiFi, horarios o reglas.
- Si falta información en "Información NO disponible", dilo con naturalidad y ofrece confirmar — NO inventes direcciones, POIs, precios ni horarios.
- No des respuestas genéricas tipo "lo reviso con el equipo" si ya tienes datos concretos en el contexto.
- No repitas check-in/WiFi si el huésped preguntó otra cosa, salvo que sea relevante para su duda.
- Tono cálido, profesional, español Colombia. Texto plano listo para Airbnb (sin markdown).
- Entre 80 y 200 palabras; prioriza utilidad sobre brevedad extrema.`;

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

function firstNonEmptyLines(text: string, maxLines = 6): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}

function buildLocationReply(input: {
  context: InboxAiContext;
  question: string;
}): string[] {
  const lines: string[] = [];
  const { knownFacts, property } = input.context;
  const asksNearby = /cerca|alrededor|qué hay|que hay|supermercado|restaurante|farmacia|transporte/i.test(
    input.question,
  );

  if (knownFacts.propertyAddress) {
    lines.push(`El alojamiento ${knownFacts.propertyName ?? property.label} queda en ${knownFacts.propertyAddress}.`);
  }

  if (knownFacts.neighborhood || knownFacts.city) {
    const zone = [knownFacts.neighborhood, knownFacts.city].filter(Boolean).join(", ");
    lines.push(`Estamos en ${zone}.`);
  }

  if (asksNearby) {
    lines.push(
      "En el barrio hay comercio, restaurantes y transporte público accesible; en Airbnb verás la ubicación exacta en el mapa del anuncio.",
    );
    lines.push(
      "Si me cuentas qué necesitas cerca (supermercado, farmacia, etc.), te oriento con más detalle.",
    );
  } else if (knownFacts.checkInTime) {
    lines.push(`El check-in es desde las ${knownFacts.checkInTime}.`);
  }

  return lines;
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
      "Sobre parqueadero: en la zona suele haber opciones de parqueo; te confirmo la más conveniente para esta propiedad en un momento.",
    );
  } else if (input.intent === "ACCESS") {
    if (input.context.knownFacts.accessCode) {
      lines.push(`El código de acceso es ${input.context.knownFacts.accessCode}.`);
    }
    if (input.context.knownFacts.accessInstructions) {
      lines.push(input.context.knownFacts.accessInstructions);
    } else if (!input.context.knownFacts.accessCode) {
      lines.push("Te comparto las instrucciones de acceso más cerca de tu llegada.");
    }
  } else if (input.intent === "LOCATION") {
    lines.push(...buildLocationReply({ context: input.context, question }));
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
    if (input.context.knownFacts.propertyAddress) {
      lines.push(`La dirección es ${input.context.knownFacts.propertyAddress}.`);
    }
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
  } else if (/ubicaci[oó]n|cerca|direcci[oó]n|llegar|mapa/i.test(question)) {
    lines.push(...buildLocationReply({ context: input.context, question }));
  } else {
    const snippet = truncateForReply(input.guestMessageBody);
    lines.push(
      `Entiendo tu consulta sobre "${snippet}".`,
    );
  }

  const quickTypes = selectQuickMessageTypesForIntent(input.intent);
  const quickRendered = quickTypes
    .map((type) =>
      buildQuickMessage(
        type,
        input.context.messageData,
        input.context.templates.templates,
      ).trim(),
    )
    .find(Boolean);

  if (quickRendered && lines.length <= 3) {
    const excerpt = firstNonEmptyLines(quickRendered, 5);
    if (excerpt.length > 40) {
      lines.push("", "Te comparto la información de la propiedad:", excerpt);
    }
  }

  if (
    input.context.knownFacts.receptionWhatsapp &&
    (input.intent === "EMERGENCY" || input.intent === "COMPLAINT" || input.context.missingFacts.length > 2)
  ) {
    lines.push(
      `También puedes escribirnos al ${input.context.knownFacts.receptionWhatsapp}.`,
    );
  } else if (input.context.missingFacts.length > 0 && lines.length <= 2) {
    lines.push("Si necesitas algo más, con gusto te ayudamos.");
  }

  return lines.filter(Boolean).join("\n\n");
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
    omitGuestMessages: true,
  });

  const conversationBlock = conversation
    ? formatConversationThreadForPrompt(conversation)
    : `Mensaje del huésped:\n"""${targetBody.trim()}"""`;

  const knowledgeBlock = formatKnowledgeForPrompt(input.context.knowledge.sections);
  const templatesBlock = formatQuickMessagesForPrompt({
    intent: input.intent,
    messageData: input.context.messageData,
    templates: input.context.templates.templates,
  });

  const userPrompt = [
    `Intención detectada: ${inboxIntentLabel(input.intent)} (${input.intent})`,
    "",
    conversationBlock,
    "",
    knowledgeBlock || "",
    templatesBlock || "",
    "",
    "Contexto operativo:",
    contextBlock,
    "",
    "Redacta una respuesta conversacional que responda directamente al mensaje objetivo del huésped, usando los detalles concretos disponibles arriba.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
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
