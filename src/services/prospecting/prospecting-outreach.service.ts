import "server-only";

import { OpenAiEnrichmentError } from "@/modules/sales-console/enrichment/enrichment.errors";
import { callOpenAiJson } from "@/modules/sales-console/enrichment/openai-sales.client";
import {
  getProspectingLeadForOrg,
  updateProspectingLeadCrm,
} from "@/services/prospecting/prospecting-crm.service";
import type { ProspectingLeadDetail } from "@/services/prospecting/prospecting-crm.types";

const OUTREACH_SYSTEM_PROMPT = `Eres un operador de alquiler vacacional en Colombia que investiga cómo otros hosts y property managers organizan su operación.

REGLAS ESTRICTAS:
- Español Colombia, tono natural y conversacional (como un colega del sector).
- NUNCA menciones PRAGMA, software, PMS, plataformas ni demos.
- NUNCA hagas pitch de ventas ni ofrezcas servicios.
- El objetivo es iniciar una conversación de descubrimiento: entender dolores operativos reales.
- Máximo 80 palabras.
- Una sola pregunta abierta al final.
- Responde ÚNICAMENTE con JSON válido: { "message": string }`;

function buildOutreachUserPrompt(lead: {
  businessName: string;
  category: string | null;
  city: string | null;
  address: string | null;
  source: string;
}): string {
  const location = lead.city ?? lead.address ?? "Medellín";
  return [
    "Genera un primer mensaje de WhatsApp para este prospecto:",
    "",
    `Nombre / empresa: ${lead.businessName}`,
    `Categoría: ${lead.category ?? "—"}`,
    `Ciudad / zona: ${location}`,
    `Fuente: ${lead.source}`,
    "",
    "El mensaje debe sonar como alguien del mismo rubro que investiga retos operativos locales.",
    'Ejemplo de tono (no copies literal): "También manejo rentas cortas y estoy investigando los mayores retos operativos de hosts en Medellín. ¿Qué parte de la operación les consume más tiempo hoy?"',
    "",
    'Devuelve JSON: { "message": string }',
  ].join("\n");
}

type OutreachPayload = { message?: unknown };

export async function generateProspectingOutreach(
  organizationId: string,
  leadId: string,
): Promise<{ lead: ProspectingLeadDetail; message: string }> {
  const lead = await getProspectingLeadForOrg(organizationId, leadId);
  if (!lead) {
    throw new Error("Prospecto no encontrado");
  }

  let payload: OutreachPayload;
  try {
    payload = await callOpenAiJson<OutreachPayload>(
      OUTREACH_SYSTEM_PROMPT,
      buildOutreachUserPrompt(lead),
    );
  } catch (error) {
    if (error instanceof OpenAiEnrichmentError) throw error;
    throw new OpenAiEnrichmentError("No fue posible generar el mensaje de contacto.");
  }

  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : null;
  if (!message) {
    throw new OpenAiEnrichmentError("OpenAI devolvió un mensaje inválido");
  }

  const updated = await updateProspectingLeadCrm(organizationId, leadId, {
    outreachMessage: message,
    logActivity: {
      type: "OUTREACH_GENERATED",
      summary: message.slice(0, 200),
    },
  });

  if (!updated) {
    throw new Error("Prospecto no encontrado");
  }

  return { lead: updated, message };
}
