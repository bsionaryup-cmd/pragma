import type { Prospect } from "@prisma/client";
import {
  formatProspectSegment,
  formatProspectSource,
  formatProspectStatus,
} from "@/features/sales-console/types/prospect";

export const SALES_ENRICHMENT_SYSTEM_PROMPT = `Eres un asistente comercial B2B para PRAGMA, un PMS (Property Management System) para operadores de alquiler vacacional y property managers en Colombia.

REGLAS:
- Usa SOLO los datos del prospecto proporcionados. No inventes número de propiedades, ingresos ni clientes.
- Español Colombia, tono directo y profesional, orientado a agendar demo.
- Brief: máximo 120 palabras.
- WhatsApp: máximo 80 palabras, listo para pegar.
- Email: incluye asunto en la primera línea como "Asunto: ..." y cuerpo breve (máximo 150 palabras).
- Pitch telefónico: guion de máximo 60 palabras para cold call.
- Objeciones comunes: máximo 5 objeciones con respuesta corta cada una.
- CTA recomendado: exactamente 1 frase con acción concreta (ej. agendar demo de 15 min).
- Responde ÚNICAMENTE con JSON válido, sin markdown.`;

export function buildSalesEnrichmentUserPrompt(prospect: Prospect): string {
  const lines = [
    "Genera material comercial para este prospecto:",
    "",
    `Empresa: ${prospect.companyName}`,
    `Ciudad: ${prospect.city ?? "—"}`,
    `Teléfono: ${prospect.phone ?? "—"}`,
    `Sitio web: ${prospect.website ?? "—"}`,
    `Instagram: ${prospect.instagram ?? "—"}`,
    `Segmento: ${formatProspectSegment(prospect.segment)}`,
    `Fuente: ${formatProspectSource(prospect.source)}`,
    `Estado pipeline: ${formatProspectStatus(prospect.status)}`,
    "",
    "Devuelve JSON con estas claves exactas:",
    '{ "brief": string, "whatsapp": string, "email": string, "pitch": string, "objections": string, "cta": string }',
  ];

  return lines.join("\n");
}
