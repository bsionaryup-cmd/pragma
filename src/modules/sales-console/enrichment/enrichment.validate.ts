import "server-only";

import { OpenAiEnrichmentError } from "@/modules/sales-console/enrichment/enrichment.errors";
import type { ProspectEnrichmentContent } from "@/modules/sales-console/enrichment/enrichment.types";

const WORD_LIMITS = {
  brief: 120,
  whatsapp: 80,
  email: 150,
  pitch: 60,
} as const;

const MAX_OBJECTION_ITEMS = 5;
export const MAX_PROSPECT_NOTES_LENGTH = 16_000;

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.trim();
  }
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function limitObjectionItems(text: string): string {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= MAX_OBJECTION_ITEMS) {
    return lines.join("\n");
  }

  return lines.slice(0, MAX_OBJECTION_ITEMS).join("\n");
}

function limitCtaToOneSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const match = trimmed.match(/^[\s\S]*?[.!?](?:\s|$)/);
  if (match) {
    return match[0].trim();
  }

  return truncateWords(trimmed, 25);
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new OpenAiEnrichmentError(`OpenAI devolvió "${field}" vacío`);
  }
  return trimmed;
}

export function normalizeEnrichmentContent(
  input: ProspectEnrichmentContent,
): ProspectEnrichmentContent {
  const brief = requireNonEmpty(input.brief, "brief");
  const whatsapp = requireNonEmpty(input.whatsapp, "whatsapp");
  const email = requireNonEmpty(input.email, "email");
  const pitch = requireNonEmpty(input.pitch, "pitch");
  const objections = requireNonEmpty(input.objections, "objections");
  const cta = requireNonEmpty(input.cta, "cta");

  return {
    brief: truncateWords(brief, WORD_LIMITS.brief),
    whatsapp: truncateWords(whatsapp, WORD_LIMITS.whatsapp),
    email: truncateWords(email, WORD_LIMITS.email),
    pitch: truncateWords(pitch, WORD_LIMITS.pitch),
    objections: limitObjectionItems(objections),
    cta: limitCtaToOneSentence(cta),
  };
}

export function truncateProspectNotes(notes: string): string {
  const trimmed = notes.trim();
  if (trimmed.length <= MAX_PROSPECT_NOTES_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_PROSPECT_NOTES_LENGTH - 1)}…`;
}
