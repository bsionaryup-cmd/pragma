import { resolvePropertyUnit } from "@/lib/property-display";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";

const PLACEHOLDER_GUEST = /^hu[eé]sped airbnb$/i;

/** Texto legible para la bandeja (sin entidades HTML). */
export function displayInboxText(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

/** Nunca mostrar placeholder de iCal en la bandeja. */
export function displayInboxGuestName(name: string, fallback = "Consulta"): string {
  const trimmed = displayInboxText(name);
  if (!trimmed || PLACEHOLDER_GUEST.test(trimmed)) return fallback;
  return trimmed;
}

/** Extrae número de apto desde etiqueta "802 — Nombre" o nombre de listing. */
export function extractInboxUnitLabel(propertyLabel: string): string | null {
  const trimmed = propertyLabel.trim();
  if (!trimmed) return null;

  const dashSplit = trimmed.split(/\s*[—–-]\s*/);
  if (dashSplit.length >= 2) {
    const leading = dashSplit[0]?.trim() ?? "";
    if (/^\d{2,4}$/.test(leading)) return leading;
  }

  return resolvePropertyUnit({ name: trimmed });
}

export function formatInboxDateRangeLabel(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  return displayInboxText(label)
    .replace(/\s*[–—]\s*/g, " – ")
    .replace(/\s+/g, " ")
    .trim();
}
