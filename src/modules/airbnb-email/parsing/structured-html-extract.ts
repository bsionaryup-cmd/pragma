/**
 * Structural extraction from Airbnb transactional HTML (tables, label rows, visible text).
 * Listing titles come from human-visible text only — never from hrefs or URL paths.
 */

import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { stripHtmlToText } from "@/modules/airbnb-email/parsing/html-parse";
import {
  listingCandidateRejectReason,
  normalizeVisibleListingName,
  scoreVisibleListingCandidate,
} from "@/modules/airbnb-email/parsing/listing-name-extract";

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
    "lugar",
    "where you'll stay",
    "where you will stay",
    "dónde te hospedarás",
    "donde te hospedaras",
    "your stay",
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

const SECTION_LISTING_LABELS = [
  "dónde te hospedarás",
  "donde te hospedaras",
  "where you'll stay",
  "where you will stay",
  "your stay",
  "reservation confirmed",
  "reserva confirmada",
  "alojamiento",
  "lugar",
];

const GARBAGE_VALUE_RE =
  /(?:\/rooms\/\d+|\/details\/|safety-info|href=|https?:\/\/|mailto:|\.png|\.jpg|unsubscribe)/i;

const CONFIRMATION_CODE_RE = /\b(HM[A-Z0-9]{6,12})\b/i;

type ListingCandidate = {
  text: string;
  source: string;
  score: number;
  reason: string;
};

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

/** Remove anchors/URLs before visible-text traversal so href paths never become listingName. */
export function sanitizeHtmlForVisibleListingExtract(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<a\b[^>]*href=["'][^"']*(?:rooms\/\d+|\/details\/|safety-info)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, " ")
    .replace(/<a\b[^>]*href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/gi, (_full, inner) => {
      const innerText = stripTags(inner ?? "");
      const reject = listingCandidateRejectReason(innerText);
      return reject ? " " : ` ${innerText} `;
    })
    .replace(/\bhref=["'][^"']+["']/gi, " ")
    .replace(/https?:\/\/[^\s"'<>]+/gi, " ")
    .replace(/\bs\/\d{5,}(?:\/[^\s"'<>]+)?/gi, " ");
}

function isGarbageValue(value: string): boolean {
  return listingCandidateRejectReason(value) !== null;
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
  let best: { key: keyof StructuredAirbnbExtract; len: number } | null = null;
  for (const [key, aliases] of Object.entries(LABEL_ALIASES)) {
    for (const alias of aliases) {
      const normAlias = normalizeLabel(alias);
      if (normalized === normAlias || normalized.startsWith(`${normAlias} `)) {
        if (!best || normAlias.length > best.len) {
          best = { key: key as keyof StructuredAirbnbExtract, len: normAlias.length };
        }
      }
    }
  }
  return best?.key ?? null;
}

function normalizeIsoDateFieldValue(value: string): string | null {
  const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  return iso ?? null;
}

function pushListingCandidate(
  candidates: ListingCandidate[],
  rawText: string,
  source: string,
): void {
  const reject = listingCandidateRejectReason(rawText);
  if (reject) {
    airbnbEmailLog.info("html_visible_listing_candidate", {
      text: rawText.slice(0, 120),
      source,
      score: 0,
      reason: `rejected:${reject}`,
    });
    return;
  }
  const normalized = normalizeVisibleListingName(rawText);
  if (!normalized) {
    airbnbEmailLog.info("html_visible_listing_candidate", {
      text: rawText.slice(0, 120),
      source,
      score: 0,
      reason: "rejected:normalize_failed",
    });
    return;
  }
  const score = scoreVisibleListingCandidate(normalized, source);
  candidates.push({
    text: normalized,
    source,
    score,
    reason: `accepted:score=${score}`,
  });
  airbnbEmailLog.info("html_visible_listing_candidate", {
    text: normalized,
    source,
    score,
    reason: `accepted:score=${score}`,
  });
}

function extractParagraphLabelRows(html: string): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const match of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(match[1] ?? "");
    const labeled = text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (!labeled?.[1] || !labeled[2]) continue;
    rows.push({ label: labeled[1].trim(), value: labeled[2].trim() });
  }
  return rows;
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
    /<(?:div|p|span|td)[^>]*>\s*(check-?in|check-?out|llegada|salida|arrival|departure|alojamiento|listing|lugar|hu[eé]sped|guest)[^<]{0,40}<\/(?:div|p|span|td)>\s*<(?:div|p|span|td)[^>]*>([\s\S]{3,200}?)<\//gi;
  for (const match of html.matchAll(blockRe)) {
    const label = stripTags(match[1] ?? "");
    const value = stripTags(match[2] ?? "");
    if (label && value && !isGarbageValue(value)) {
      pairs.push({ label, value });
    }
  }
  return pairs;
}

function extractSectionListingCandidates(html: string): ListingCandidate[] {
  const candidates: ListingCandidate[] = [];
  for (const label of SECTION_LISTING_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sectionRe = new RegExp(
      `${escaped}[\\s\\S]{0,900}?<(?:div|p|span|h\\d|strong|b|td)[^>]*>([\\s\\S]{8,220}?)<\\/(?:div|p|span|h\\d|strong|b|td)>`,
      "gi",
    );
    for (const match of html.matchAll(sectionRe)) {
      pushListingCandidate(candidates, stripTags(match[1] ?? ""), `section:${label}`);
    }
  }
  return candidates;
}

function extractHeadingListingCandidates(html: string): ListingCandidate[] {
  const candidates: ListingCandidate[] = [];
  const headingRe = /<h[1-4][^>]*>([\s\S]{8,220}?)<\/h[1-4]>/gi;
  for (const match of html.matchAll(headingRe)) {
    pushListingCandidate(candidates, stripTags(match[1] ?? ""), "heading:h");
  }
  return candidates;
}

function extractVisibleBlockCandidates(html: string): ListingCandidate[] {
  const candidates: ListingCandidate[] = [];
  const blockRe =
    /<(?:strong|b|p|div|span|td)[^>]*>([\s\S]{10,220}?)<\/(?:strong|b|p|div|span|td)>/gi;
  for (const match of html.matchAll(blockRe)) {
    const raw = match[1] ?? "";
    if (/href\s*=|airbnb\.com|rooms\/\d|safety-info|\/details\//i.test(raw)) continue;
    const stripped = stripTags(raw);
    if (/^(?:check-?in|check-?out|hu[eé]sped|guest|c[oó]digo)/i.test(stripped)) {
      continue;
    }
    pushListingCandidate(candidates, stripped, "visible_block");
  }
  return candidates;
}

function extractVisibleLineCandidates(html: string): ListingCandidate[] {
  const candidates: ListingCandidate[] = [];
  const plain = stripHtmlToText(html);
  for (const line of plain.split("\n")) {
    pushListingCandidate(candidates, line, "visible_line");
  }
  return candidates;
}

function extractVisibleListingCandidates(html: string): ListingCandidate[] {
  const candidates: ListingCandidate[] = [];
  const labeledRows = [
    ...extractParagraphLabelRows(html),
    ...extractTableLabelRows(html),
    ...extractDivLabelPairs(html),
  ];

  for (const row of labeledRows) {
    const key = fieldKeyForLabel(row.label);
    if (key !== "listingName") continue;
    pushListingCandidate(candidates, row.value, `table:${row.label}`);
  }

  candidates.push(
    ...extractSectionListingCandidates(html),
    ...extractHeadingListingCandidates(html),
    ...extractVisibleBlockCandidates(html),
    ...extractVisibleLineCandidates(html),
  );

  const deduped = new Map<string, ListingCandidate>();
  for (const candidate of candidates) {
    const key = candidate.text.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || candidate.score > existing.score) {
      deduped.set(key, candidate);
    }
  }
  return [...deduped.values()];
}

function pickBestListingCandidate(candidates: ListingCandidate[]): ListingCandidate | null {
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const top = ranked[0]!;
  const second = ranked[1];
  if (second && top.score - second.score < 8 && top.score < 70) {
    airbnbEmailLog.warn("structured_listing_ambiguous", {
      topText: top.text,
      topScore: top.score,
      secondText: second.text,
      secondScore: second.score,
    });
    return null;
  }
  if (top.score < 20) {
    airbnbEmailLog.warn("structured_listing_skipped", {
      reason: "top_score_below_threshold",
      topText: top.text,
      topScore: top.score,
      candidateCount: ranked.length,
    });
    return null;
  }
  return top;
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

  const sanitizedHtml = sanitizeHtmlForVisibleListingExtract(html);
  const result = { ...empty, sources: [] as string[] };
  const listingCandidates = extractVisibleListingCandidates(sanitizedHtml);

  const bestListing = pickBestListingCandidate(listingCandidates);
  if (bestListing) {
    result.listingName = bestListing.text;
    result.sources.push(bestListing.source);
    airbnbEmailLog.info("structured_listing_extracted", {
      listingName: bestListing.text,
      selectedText: bestListing.text,
      source: bestListing.source,
      score: bestListing.score,
      reason: bestListing.reason,
      candidateCount: listingCandidates.length,
    });
  } else {
    airbnbEmailLog.warn("structured_listing_skipped", {
      reason: "no_acceptable_visible_listing_candidate",
      candidateCount: listingCandidates.length,
    });
  }

  const labeledRows = [
    ...extractParagraphLabelRows(sanitizedHtml),
    ...extractTableLabelRows(sanitizedHtml),
    ...extractDivLabelPairs(sanitizedHtml),
  ];

  for (const row of labeledRows) {
    const key = fieldKeyForLabel(row.label);
    if (!key || key === "sources" || key === "listingName") continue;
    const current = result[key];
    if (current) continue;

    if (key === "confirmationCode") {
      const code = row.value.match(CONFIRMATION_CODE_RE)?.[1];
      if (code) {
        result.confirmationCode = code.toUpperCase();
        result.sources.push(`table:${row.label}`);
      }
      continue;
    }

    if (key === "checkIn" || key === "checkOut") {
      const iso = normalizeIsoDateFieldValue(row.value);
      if (iso) {
        result[key] = iso;
        result.sources.push(`table:${row.label}`);
      }
      continue;
    }

    if (!isGarbageValue(row.value)) {
      result[key] = row.value;
      result.sources.push(`table:${row.label}`);
    }
  }

  const plainFromHtml = stripHtmlToText(sanitizedHtml);
  if (!result.confirmationCode) {
    const code = plainFromHtml.match(CONFIRMATION_CODE_RE)?.[1];
    if (code) {
      result.confirmationCode = code.toUpperCase();
      result.sources.push("html_text:confirmation");
    }
  }

  if (!result.checkIn || !result.checkOut) {
    const isoFallback = extractIsoDatesFromHtml(sanitizedHtml);
    if (!result.checkIn && isoFallback.checkIn) {
      result.checkIn = isoFallback.checkIn;
      result.sources.push("html_iso:checkIn");
    }
    if (!result.checkOut && isoFallback.checkOut) {
      result.checkOut = isoFallback.checkOut;
      result.sources.push("html_iso:checkOut");
    }
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
