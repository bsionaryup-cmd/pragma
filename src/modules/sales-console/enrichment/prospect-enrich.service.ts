import "server-only";

import { formatEnrichmentNotes } from "@/modules/sales-console/enrichment/enrichment.format";
import {
  buildSalesEnrichmentUserPrompt,
  SALES_ENRICHMENT_SYSTEM_PROMPT,
} from "@/modules/sales-console/enrichment/enrichment.prompts";
import type {
  ProspectEnrichmentContent,
  ProspectEnrichmentResult,
} from "@/modules/sales-console/enrichment/enrichment.types";
import { callOpenAiJson } from "@/modules/sales-console/enrichment/openai-sales.client";
import {
  getProspectById,
  updateProspectNotes,
} from "@/modules/sales-console/services/prospect.service";

type OpenAiEnrichmentPayload = {
  brief?: unknown;
  whatsapp?: unknown;
  email?: unknown;
  phonePitch?: unknown;
  objections?: unknown;
  cta?: unknown;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`OpenAI devolvió "${field}" inválido`);
  }
  return value.trim();
}

function parseEnrichmentPayload(payload: OpenAiEnrichmentPayload): ProspectEnrichmentContent {
  return {
    brief: requireString(payload.brief, "brief"),
    whatsapp: requireString(payload.whatsapp, "whatsapp"),
    email: requireString(payload.email, "email"),
    phonePitch: requireString(payload.phonePitch, "phonePitch"),
    objections: requireString(payload.objections, "objections"),
    cta: requireString(payload.cta, "cta"),
  };
}

export async function enrichProspect(prospectId: string): Promise<ProspectEnrichmentResult> {
  const prospect = await getProspectById(prospectId);
  if (!prospect) {
    throw new Error("Prospecto no encontrado");
  }
  if (prospect.archived) {
    throw new Error("No se puede enriquecer un prospecto archivado");
  }

  const payload = await callOpenAiJson<OpenAiEnrichmentPayload>(
    SALES_ENRICHMENT_SYSTEM_PROMPT,
    buildSalesEnrichmentUserPrompt(prospect),
  );
  const content = parseEnrichmentPayload(payload);
  const notes = formatEnrichmentNotes(content);

  await updateProspectNotes(prospectId, notes);

  return { notes, content };
}
