/**
 * Structural extraction from Airbnb transactional HTML (tables, label rows, anchors).
 * Avoids relying on degraded Gmail/Outlook forward plaintext.
 */

import { extractAnchorHrefs, stripHtmlToText } from "@/modules/airbnb-email/parsing/html-parse";

export type StructuredAirbnbExtract = {
  listingName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guestName: string | null;
  confirmationCode: string | null;
  sources: string[];
};

const LABEL_ALIASES: Record<string, string[]> = {
  checkIn: ["check-in", "check in", "llegada", "arrival", "entrada"],
  checkOut: ["check-out", "check out", "salida", "departure", "checkout"],
  listingName: [
    "alojamiento",
    "listing",
    "property",
    "lugar",
    "where you'll stay",
    "where you will stay",
    "dónde te hospedarás",
    "donde te hospedaras",
    "your place",
  ],
  guestName: ["huésped", "huesped", "guest", "viajero", "traveler"],
  confirmationCode: [
    "código de confirmación",
    "codigo de confirmacion",
    "confirmation code",
    "reservation code",
  ],
};

const GARBAGE_VALUE_RE =
  /(?:\/rooms\/\d+|\/details\/|safety-info|href=|https?:\/\/|mailto:|\.png|\.jpg|unsubscribe)/i;

const CONFIRMATION_CODE_RE = /\b(HM[A-Z0-9]{6,12})\b/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(fragment: string): string {
  return decodeHtmlEntities(fragment.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function isGarbageValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 2) return true;
  if (GARBAGE_VALUE_RE.test(trimmed)) return true;
  if (/^s\/\d+/.test(trimmed)) return true;
  return false;
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:\s]+/g, " ")
    .trim();
}

function fieldKeyForLabel(label: string): keyof StructuredAirbnbExtract | null {
  const normalized = normalizeLabel(label);
  for (const [key, aliases] of Object.entries(LABEL_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(normalizeLabel(alias)))) {
      return key as keyof StructuredAirbnbExtract;
    }
  }
  return null;
}

function cleanListingName(value: string): string | null {
  let cleaned = value.replace(/\s+/g, " ").trim();
  if (isGarbageValue(cleaned)) return null;
  cleaned = cleaned.split(/[|•]/)[0]?.trim() ?? cleaned;
  if (cleaned.length < 4 || cleaned.length > 180) return null;
  if (/es adecuado para niñ/i.test(cleaned)) return null;
  return cleaned;
}

function extractTableLabelRows(html: string): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      stripTags(cell[1] ?? ""),
    );
    if (cells.length < 2) continue;
    const label = cells[0] ?? "";
    const value = cells.slice(1).join(" ").trim();
    if (!label || !value || isGarbageValue(value)) continue;
    rows.push({ label, value });
  }
  return rows;
}

function extractDivLabelPairs(html: string): Array<{ label: string; value: string }> {
  const pairs: Array<{ label: string; value: string }> = [];
  const blockRe =
    /<(?:div|p|span|td)[^>]*>\s*(check-?in|check-?out|llegada|salida|arrival|departure|alojamiento|listing|lugar|hu[eé]sped|guest)[^<]{0,40}<\/(?:div|p|span|td)>\s*<(?:div|p|span|td)[^>]*>([\s\S]{3,120}?)<\//gi;
  for (const match of html.matchAll(blockRe)) {
    const label = stripTags(match[0].split(">")[0] ?? match[1] ?? "");
    const value = stripTags(match[2] ?? "");
    if (label && value && !isGarbageValue(value)) {
      pairs.push({ label, value });
    }
  }
  return pairs;
}

function extractHeadingListing(html: string): string | null {
  const sectionRe =
    /(?:dónde te hospedarás|donde te hospedaras|where you(?:'|&#39;)ll stay|your place|alojamiento)\s*<\/[^>]+>[\s\S]{0,400}?<(?:a|span|div|p|h\d)[^>]*>([^<]{4,180})</gi;
  for (const match of html.matchAll(sectionRe)) {
    const candidate = cleanListingName(stripTags(match[1] ?? ""));
    if (candidate) return candidate;
  }

  for (const href of extractAnchorHrefs(html)) {
    if (!/airbnb\.com\/(?:h\/|rooms\/)/i.test(href)) continue;
    const anchorRe = new RegExp(
      `<a[^>]+href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>([\\s\\S]{4,180}?)<\\/a>`,
      "i",
    );
    const anchorMatch = html.match(anchorRe);
    const text = cleanListingName(stripTags(anchorMatch?.[1] ?? ""));
    if (text) return text;
  }

  return null;
}

function extractIsoDatesFromHtml(html: string): { checkIn: string | null; checkOut: string | null } {
  const isoDates = [...html.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]!);
  const unique = [...new Set(isoDates)];
  if (unique.length >= 2) {
    const sorted = unique.sort();
    return { checkIn: sorted[0]!, checkOut: sorted[1]! };
  }
  if (unique.length === 1) {
    return { checkIn: unique[0]!, checkOut: null };
  }
  return { checkIn: null, checkOut: null };
}

export function extractStructuredAirbnbFields(
  html: string | null | undefined,
): StructuredAirbnbExtract {
  const empty: StructuredAirbnbExtract = {
    listingName: null,
    checkIn: null,
    checkOut: null,
    guestName: null,
    confirmationCode: null,
    sources: [],
  };
  if (!html?.trim()) return empty;

  const result = { ...empty, sources: [] as string[] };
  const labeledRows = [
    ...extractTableLabelRows(html),
    ...extractDivLabelPairs(html),
  ];

  for (const row of labeledRows) {
    const key = fieldKeyForLabel(row.label);
    if (!key || key === "sources") continue;
    const current = result[key];
    if (current) continue;

    if (key === "listingName") {
      const cleaned = cleanListingName(row.value);
      if (cleaned) {
        result.listingName = cleaned;
        result.sources.push(`table:${row.label}`);
      }
      continue;
    }

    if (key === "confirmationCode") {
      const code = row.value.match(CONFIRMATION_CODE_RE)?.[1];
      if (code) {
        result.confirmationCode = code.toUpperCase();
        result.sources.push(`table:${row.label}`);
      }
      continue;
    }

    if (!isGarbageValue(row.value)) {
      result[key] = row.value;
      result.sources.push(`table:${row.label}`);
    }
  }

  if (!result.listingName) {
    const headingListing = extractHeadingListing(html);
    if (headingListing) {
      result.listingName = headingListing;
      result.sources.push("heading_section");
    }
  }

  const plainFromHtml = stripHtmlToText(html);
  if (!result.confirmationCode) {
    const code = plainFromHtml.match(CONFIRMATION_CODE_RE)?.[1];
    if (code) {
      result.confirmationCode = code.toUpperCase();
      result.sources.push("html_text:confirmation");
    }
  }

  const isoFallback = extractIsoDatesFromHtml(html);
  if (!result.checkIn && isoFallback.checkIn) {
    result.checkIn = isoFallback.checkIn;
    result.sources.push("html_iso:checkIn");
  }
  if (!result.checkOut && isoFallback.checkOut) {
    result.checkOut = isoFallback.checkOut;
    result.sources.push("html_iso:checkOut");
  }

  return result;
}

export function isDegradedForwardPlainText(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  const normalized = text.toLowerCase();
  const hasForwardMarker =
    normalized.includes("forwarded message") ||
    normalized.includes("mensaje reenviado") ||
    normalized.includes("begin forwarded");
  const hasOperationalLabels =
    /check-?in|llegada|arrival/.test(normalized) &&
    /check-?out|salida|departure/.test(normalized);
  const hasListing =
    /alojamiento|listing|hospedar|where you/.test(normalized) ||
    /loft|apartamento|habitaci[oó]n/i.test(normalized);
  if (hasForwardMarker && (!hasOperationalLabels || !hasListing)) return true;
  if (!hasOperationalLabels && text.length < 400) return true;
  return false;
}

export function htmlPayloadRichness(html: string | null | undefined): number {
  if (!html?.trim()) return 0;
  const tableRows = (html.match(/<tr[^>]*>/gi) ?? []).length;
  const isoDates = (html.match(/\b20\d{2}-\d{2}-\d{2}\b/g) ?? []).length;
  const airbnbLinks = (html.match(/airbnb\.com/gi) ?? []).length;
  return tableRows * 3 + isoDates * 2 + airbnbLinks;
}
