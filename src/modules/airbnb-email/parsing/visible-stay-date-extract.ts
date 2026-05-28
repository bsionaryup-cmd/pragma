/**
 * Visible stay-date extraction for Airbnb HTML (check-in / check-out).
 * Never uses listing candidate scoring or listing heuristics.
 */

import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { stripHtmlToText } from "@/modules/airbnb-email/parsing/html-parse";

const MONTHS: Record<string, number> = {
  ene: 1,
  enero: 1,
  jan: 1,
  january: 1,
  feb: 2,
  febrero: 2,
  february: 2,
  mar: 3,
  marzo: 3,
  march: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  april: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  june: 6,
  jul: 7,
  julio: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  september: 9,
  oct: 10,
  octubre: 10,
  october: 10,
  nov: 11,
  noviembre: 11,
  november: 11,
  dic: 12,
  diciembre: 12,
  dec: 12,
  december: 12,
};

const WEEKDAY_PREFIX_RE =
  /^(?:lun(?:es)?|mar(?:tes)?|mi[eé](?:rcoles)?|jue(?:ves)?|vie(?:rn[eo]s)?|s[aá]b(?:ado)?|dom(?:ingo)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)[,.]?\s+/i;

/** Airbnb visible date: "vie, 19 jun" | "19 jun" | "19 de junio de 2026" */
const VISIBLE_STAY_DATE_FRAGMENT_RE =
  /(?:^|[\s,])(?:(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom|mon|tue|wed|thu|fri|sat|sun)[a-z]*[,.]?\s*)?(\d{1,2})(?:\s+de\s+([a-záéíóúñ.]+)(?:\s+de\s+(\d{4}))?|\s+([a-záéíóúñ.]+)(?:\s+(\d{4}))?)/gi;

const CHECKIN_LABEL_RE =
  /(?:check-?in|llegada|arrival|entrada)\s*:?\s*([^\n<]{4,60})/gi;
const CHECKOUT_LABEL_RE =
  /(?:check-?out|salida|departure|checkout)\s*:?\s*([^\n<]{4,60})/gi;

export type VisibleStayDates = {
  checkIn: string | null;
  checkOut: string | null;
  sources: string[];
};

function inferBookingYear(day: number, month: number, referenceYear?: number): number {
  if (referenceYear && Number.isFinite(referenceYear)) {
    return referenceYear;
  }
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth() + 1;
  const utcDay = now.getUTCDate();
  if (month > utcMonth || (month === utcMonth && day >= utcDay)) {
    return utcYear;
  }
  if (month < utcMonth - 1) {
    return utcYear + 1;
  }
  return utcYear + 1;
}

function monthFromToken(token: string): number | null {
  const key = token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();
  return MONTHS[key] ?? null;
}

export function looksLikeVisibleStayDateLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  return normalizeVisibleStayDate(trimmed) !== null;
}

export function normalizeVisibleStayDate(
  value: string | null | undefined,
  options?: { referenceYear?: number },
): string | null {
  if (!value?.trim()) return null;

  let raw = value
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");

  raw = raw.replace(WEEKDAY_PREFIX_RE, "").trim();

  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (iso) return iso;

  const deFull = raw.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ.]+)\s+de\s+(\d{4})$/i);
  if (deFull?.[1] && deFull[2] && deFull[3]) {
    const day = Number(deFull[1]);
    const month = monthFromToken(deFull[2]);
    const year = Number(deFull[3]);
    if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null;
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  const dayMonthYear = raw.match(/^(\d{1,2})\s+([a-záéíóúñ.]+)\s+(\d{4})$/i);
  if (dayMonthYear?.[1] && dayMonthYear[2] && dayMonthYear[3]) {
    const day = Number(dayMonthYear[1]);
    const month = monthFromToken(dayMonthYear[2]);
    const year = Number(dayMonthYear[3]);
    if (!month || !Number.isFinite(day)) return null;
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  const dayMonth = raw.match(/^(\d{1,2})\s+([a-záéíóúñ.]+)$/i);
  if (dayMonth?.[1] && dayMonth[2]) {
    const day = Number(dayMonth[1]);
    const month = monthFromToken(dayMonth[2]);
    if (!month || !Number.isFinite(day)) return null;
    const year = inferBookingYear(day, month, options?.referenceYear);
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  return null;
}

type ParsedStayDate = { iso: string; index: number; raw: string };

function collectStayDateFragments(text: string, referenceYear?: number): ParsedStayDate[] {
  const found: ParsedStayDate[] = [];
  for (const match of text.matchAll(VISIBLE_STAY_DATE_FRAGMENT_RE)) {
    const raw = (match[0] ?? "").trim();
    const iso = normalizeVisibleStayDate(raw, { referenceYear });
    if (!iso) continue;
    found.push({ iso, index: match.index ?? 0, raw });
  }
  return found;
}

function pickCheckInCheckOut(dates: ParsedStayDate[]): {
  checkIn: string | null;
  checkOut: string | null;
} {
  if (dates.length === 0) {
    return { checkIn: null, checkOut: null };
  }

  const uniqueOrdered: ParsedStayDate[] = [];
  const seen = new Set<string>();
  for (const row of [...dates].sort((a, b) => a.index - b.index)) {
    if (seen.has(row.iso)) continue;
    seen.add(row.iso);
    uniqueOrdered.push(row);
  }

  if (uniqueOrdered.length === 1) {
    return { checkIn: uniqueOrdered[0]!.iso, checkOut: null };
  }

  const sortedByIso = [...uniqueOrdered].sort((a, b) => a.iso.localeCompare(b.iso));
  return {
    checkIn: sortedByIso[0]!.iso,
    checkOut: sortedByIso[1]!.iso,
  };
}

function extractLabeledStayDates(html: string, referenceYear?: number): VisibleStayDates {
  const sources: string[] = [];
  let checkIn: string | null = null;
  let checkOut: string | null = null;

  for (const match of html.matchAll(CHECKIN_LABEL_RE)) {
    const iso = normalizeVisibleStayDate(match[1], { referenceYear });
    if (iso) {
      checkIn = iso;
      sources.push("visible_date:checkIn_label");
      break;
    }
  }

  for (const match of html.matchAll(CHECKOUT_LABEL_RE)) {
    const iso = normalizeVisibleStayDate(match[1], { referenceYear });
    if (iso) {
      checkOut = iso;
      sources.push("visible_date:checkOut_label");
      break;
    }
  }

  return { checkIn, checkOut, sources };
}

function extractFromTableCells(html: string, referenceYear?: number): VisibleStayDates {
  const cellDates: ParsedStayDate[] = [];
  for (const match of html.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
    const text = match[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
    if (!text || text.length > 60) continue;
    if (!looksLikeVisibleStayDateLine(text)) continue;
    const iso = normalizeVisibleStayDate(text, { referenceYear });
    if (iso) {
      cellDates.push({ iso, index: match.index ?? 0, raw: text });
    }
  }

  const picked = pickCheckInCheckOut(cellDates);
  if (!picked.checkIn) {
    return { checkIn: null, checkOut: null, sources: [] };
  }

  return {
    checkIn: picked.checkIn,
    checkOut: picked.checkOut,
    sources: ["visible_date:table_cell"],
  };
}

/**
 * Extract check-in / check-out from visible Airbnb HTML text.
 */
export function extractVisibleStayDates(
  html: string | null | undefined,
  options?: { referenceYear?: number },
): VisibleStayDates {
  const empty: VisibleStayDates = { checkIn: null, checkOut: null, sources: [] };
  if (!html?.trim()) return empty;

  const labeled = extractLabeledStayDates(html, options?.referenceYear);
  if (labeled.checkIn && labeled.checkOut) {
    airbnbEmailLog.info("visible_stay_dates_extracted", {
      checkIn: labeled.checkIn,
      checkOut: labeled.checkOut,
      sources: labeled.sources.join(","),
    });
    return labeled;
  }

  const fromCells = extractFromTableCells(html, options?.referenceYear);
  let checkIn = labeled.checkIn ?? fromCells.checkIn;
  let checkOut = labeled.checkOut ?? fromCells.checkOut;
  const sources = [...labeled.sources, ...fromCells.sources];

  if (!checkIn || !checkOut) {
    const plain = stripHtmlToText(html);
    const fragments = collectStayDateFragments(plain, options?.referenceYear);
    const picked = pickCheckInCheckOut(fragments);
    if (!checkIn && picked.checkIn) {
      checkIn = picked.checkIn;
      sources.push("visible_date:plain_text");
    }
    if (!checkOut && picked.checkOut) {
      checkOut = picked.checkOut;
      if (!sources.includes("visible_date:plain_text")) {
        sources.push("visible_date:plain_text");
      }
    }
  }

  if (checkIn) {
    airbnbEmailLog.info("visible_stay_date_candidate", {
      role: "checkIn",
      raw: checkIn,
      iso: checkIn,
      source: sources[0] ?? "visible_date",
    });
  }
  if (checkOut) {
    airbnbEmailLog.info("visible_stay_date_candidate", {
      role: "checkOut",
      raw: checkOut,
      iso: checkOut,
      source: sources[sources.length - 1] ?? "visible_date",
    });
  }

  if (checkIn || checkOut) {
    airbnbEmailLog.info("visible_stay_dates_extracted", {
      checkIn: checkIn ?? undefined,
      checkOut: checkOut ?? undefined,
      sources: sources.join(","),
    });
  }

  return { checkIn, checkOut, sources };
}
