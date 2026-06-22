import "server-only";

import { OpenAiEnrichmentError } from "@/modules/sales-console/enrichment/enrichment.errors";
import { formatEnrichmentNotes } from "@/modules/sales-console/enrichment/enrichment.format";
import {
  buildSalesEnrichmentUserPrompt,
  SALES_ENRICHMENT_SYSTEM_PROMPT,
} from "@/modules/sales-console/enrichment/enrichment.prompts";
import type {
  ProspectEnrichmentContent,
  ProspectEnrichmentResult,
} from "@/modules/sales-console/enrichment/enrichment.types";
import {
  normalizeEnrichmentContent,
  truncateProspectNotes,
} from "@/modules/sales-console/enrichment/enrichment.validate";
import { callOpenAiJson } from "@/modules/sales-console/enrichment/openai-sales.client";
import {
  getProspectById,
  updateProspectNotes,
} from "@/modules/sales-console/services/prospect.service";

type OpenAiEnrichmentPayload = {
  brief?: unknown;
  whatsapp?: unknown;
  email?: unknown;
  pitch?: unknown;
  phonePitch?: unknown;
  objections?: unknown;
  cta?: unknown;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OpenAiEnrichmentError(`OpenAI devolvió "${field}" inválido`);
  }
  return value.trim();
}

function parseEnrichmentPayload(payload: OpenAiEnrichmentPayload): ProspectEnrichmentContent {
  const pitchSource = payload.pitch ?? payload.phonePitch;

  return normalizeEnrichmentContent({
    brief: requireString(payload.brief, "brief"),
    whatsapp: requireString(payload.whatsapp, "whatsapp"),
    email: requireString(payload.email, "email"),
    pitch: requireString(pitchSource, "pitch"),
    objections: requireString(payload.objections, "objections"),
    cta: requireString(payload.cta, "cta"),
  });
}

export async function enrichProspect(prospectId: string): Promise<ProspectEnrichmentResult> {
  try {
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
    const notes = truncateProspectNotes(formatEnrichmentNotes(content));

    await updateProspectNotes(prospectId, notes);

    return { notes, content };
  } catch (error) {
    if (error instanceof Error && error.message === "Prospecto no encontrado") {
      throw error;
    }
    if (error instanceof Error && error.message === "No se puede enriquecer un prospecto archivado") {
      throw error;
    }
    if (error instanceof OpenAiEnrichmentError) {
      throw error;
    }
    throw new OpenAiEnrichmentError();
  }
}
