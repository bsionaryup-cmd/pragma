import "server-only";

import type { ProspectingFitLevel, ProspectingLeadType } from "@prisma/client";
import { OpenAiEnrichmentError } from "@/modules/sales-console/enrichment/enrichment.errors";
import { callOpenAiJson } from "@/modules/sales-console/enrichment/openai-sales.client";
import {
  getProspectingLeadForOrg,
  updateProspectingLeadCrm,
} from "@/services/prospecting/prospecting-crm.service";
import type { ProspectingLeadDetail } from "@/services/prospecting/prospecting-crm.types";

const INSIGHTS_SYSTEM_PROMPT = `Clasifica prospectos de alquiler vacacional / property management en Colombia para priorización comercial interna.

REGLAS:
- Usa SOLO los datos proporcionados. No inventes propiedades ni ingresos.
- leadType debe ser exactamente uno de: PROPERTY_MANAGER, CO_HOST, HOST, HOTEL, HOSTEL, VACATION_RENTAL_OPERATOR, UNKNOWN
- estimatedSophistication y potentialPragmaFit: LOW, MEDIUM o HIGH
- reasoning: máximo 60 palabras, español Colombia
- Responde ÚNICAMENTE JSON válido`;

const LEAD_TYPES: ProspectingLeadType[] = [
  "PROPERTY_MANAGER",
  "CO_HOST",
  "HOST",
  "HOTEL",
  "HOSTEL",
  "VACATION_RENTAL_OPERATOR",
  "UNKNOWN",
];

const FIT_LEVELS: ProspectingFitLevel[] = ["LOW", "MEDIUM", "HIGH"];

type InsightsPayload = {
  leadType?: unknown;
  estimatedSophistication?: unknown;
  potentialPragmaFit?: unknown;
  reasoning?: unknown;
};

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function buildInsightsUserPrompt(lead: {
  businessName: string;
  phone: string | null;
  website: string | null;
  category: string | null;
  city: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  source: string;
  listingsCount: number | null;
}): string {
  return [
    "Clasifica este prospecto:",
    "",
    `Empresa: ${lead.businessName}`,
    `Teléfono: ${lead.phone ?? "—"}`,
    `Sitio web: ${lead.website ?? "—"}`,
    `Categoría: ${lead.category ?? "—"}`,
    `Ciudad: ${lead.city ?? "—"}`,
    `Dirección: ${lead.address ?? "—"}`,
    `Rating: ${lead.rating ?? "—"}`,
    `Reseñas: ${lead.reviews ?? "—"}`,
    `Listings (si Airbnb): ${lead.listingsCount ?? "—"}`,
    `Fuente: ${lead.source}`,
    "",
    'JSON: { "leadType": string, "estimatedSophistication": string, "potentialPragmaFit": string, "reasoning": string }',
  ].join("\n");
}

export async function generateProspectingInsights(
  organizationId: string,
  leadId: string,
): Promise<{
  lead: ProspectingLeadDetail;
  leadType: ProspectingLeadType;
  estimatedSophistication: ProspectingFitLevel;
  potentialPragmaFit: ProspectingFitLevel;
  reasoning: string;
}> {
  const lead = await getProspectingLeadForOrg(organizationId, leadId);
  if (!lead) {
    throw new Error("Prospecto no encontrado");
  }

  let payload: InsightsPayload;
  try {
    payload = await callOpenAiJson<InsightsPayload>(
      INSIGHTS_SYSTEM_PROMPT,
      buildInsightsUserPrompt(lead),
    );
  } catch (error) {
    if (error instanceof OpenAiEnrichmentError) throw error;
    throw new OpenAiEnrichmentError("No fue posible clasificar el prospecto.");
  }

  const leadType = pickEnum(payload.leadType, LEAD_TYPES) ?? "UNKNOWN";
  const estimatedSophistication =
    pickEnum(payload.estimatedSophistication, FIT_LEVELS) ?? "MEDIUM";
  const potentialPragmaFit = pickEnum(payload.potentialPragmaFit, FIT_LEVELS) ?? "MEDIUM";
  const reasoning =
    typeof payload.reasoning === "string" && payload.reasoning.trim()
      ? payload.reasoning.trim().slice(0, 500)
      : "Clasificación generada automáticamente.";

  const updated = await updateProspectingLeadCrm(organizationId, leadId, {
    leadType,
    estimatedSophistication,
    potentialPragmaFit,
    logActivity: {
      type: "INSIGHTS_GENERATED",
      summary: `${leadType} · Fit ${potentialPragmaFit} · ${reasoning.slice(0, 120)}`,
    },
  });

  if (!updated) {
    throw new Error("Prospecto no encontrado");
  }

  return {
    lead: updated,
    leadType,
    estimatedSophistication,
    potentialPragmaFit,
    reasoning,
  };
}
