import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import {
  extractLabeledValues,
  extractMessageSnippet,
  normalizeAirbnbForwardedText,
  extractReviewText,
  stripHtmlToText,
} from "@/modules/airbnb-email/parsing/html-parse";
import { extractAirbnbListingRefs } from "@/modules/airbnb-email/parsing/airbnb-url-extract";
import {
  buildEmailMatchBlob,
  resolveGuestNameFromSignals,
} from "@/modules/airbnb-email/parsing/guest-name-extract";
import {
  isPlausibleVisibleListingName,
  normalizeListingNameForMatch,
  normalizeVisibleListingName,
} from "@/modules/airbnb-email/parsing/listing-name-extract";
import {
  extractStructuredAirbnbFields,
  htmlPayloadRichness,
  isDegradedForwardPlainText,
} from "@/modules/airbnb-email/parsing/structured-html-extract";

const CONFIRMATION_CODE_RE = /\b(HM[A-Z0-9]{6,12})\b/i;
const EMAIL_RE = /\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/gi;
const GUEST_COUNT_RE =
  /\b(\d{1,2})\s*(?:huéspedes|guests|viajeros|travelers)\b/gi;
const DATE_RANGE_RE =
  /(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+\d{4})\s*(?:→|–|-|to|a)\s*(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+\d{4})/i;
const ISO_DATE_RANGE_RE =
  /(\d{4}-\d{2}-\d{2})\s*(?:→|–|-|to|a)\s*(\d{4}-\d{2}-\d{2})/;
const MONEY_INLINE_RE = /(?:\$|USD|COP|€)\s*([\d.,]+)/gi;
const RATING_RE = /(\d(?:\.\d)?)\s*(?:estrellas|stars|★|\/5)/i;
const GUEST_NAME_RE =
  /(?:huésped|guest|viajero|traveler)[:\s]+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,60})/gi;
const UNIT_NUMBER_RE =
  /(?:unidad|unit|apto|apt|apartamento)\s*(?:#|n[°º.]?|no\.?)?\s*([a-z0-9-]{1,12})/i;
const DATE_TOKEN_RE =
  /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\s+de\s+[a-záéíóúñ.]+\s+de\s+\d{4}|\d{1,2}\s+[a-záéíóúñ.]+\s+\d{4})\b/i;
const LISTING_LABEL_RE =
  /(?:alojamiento|listing(?:\s+name)?|lugar|where you(?:'|&#39;)?ll stay)\s*:?\s*([^\n]{8,220})/i;
const CHECKIN_RE = /(?:check-?in|llegada|arrival)\s*:?\s*([^\n]{3,80})/i;
const CHECKOUT_RE = /(?:check-?out|salida|departure)\s*:?\s*([^\n]{3,80})/i;
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

function parseMoneyToken(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const normalized = raw.replace(/[^\d.,-]/g, "");
  let value = normalized;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    value = normalized.replace(/,/g, "");
  } else if (/^\d+(\.\d+)?$/.test(normalized)) {
    value = normalized;
  } else if (/^\d+(,\d+)?$/.test(normalized)) {
    value = normalized.replace(",", ".");
  } else {
    value = normalized.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractGuestEmail(text: string): string | null {
  const labeled = text.match(
    /(?:correo|email|e-mail)[:\s]+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  )?.[1];
  if (labeled && !isAirbnbOwnedEmail(labeled)) return labeled.toLowerCase();

  for (const match of text.matchAll(EMAIL_RE)) {
    const candidate = match[1]?.trim().toLowerCase();
    if (candidate && !isAirbnbOwnedEmail(candidate)) return candidate;
  }
  return null;
}

function isAirbnbOwnedEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return (
    lower.endsWith("@airbnb.com") ||
    lower.endsWith("@airbnbmail.com") ||
    lower.includes("noreply") ||
    lower.includes("no-reply")
  );
}

function extractGuestPhone(text: string, merged: Record<string, string>): string | null {
  const labeled = merged.guestPhone?.trim();
  if (labeled) return normalizePhone(labeled);

  const match = text.match(
    /(?:teléfono|telefono|phone|móvil|mobile|celular)[:\s]+([+\d][\d\s().-]{7,18})/i,
  );
  return match?.[1] ? normalizePhone(match[1]) : null;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "").trim();
  return digits.length >= 8 ? digits : raw.trim();
}

function parseGuestCount(text: string, merged: Record<string, string>): number | null {
  const labeledDigits = merged.guestCount?.match(/\d{1,2}/)?.[0];
  if (labeledDigits) {
    const n = Number(labeledDigits);
    if (Number.isFinite(n) && n > 0 && n <= 30) return n;
  }

  let last: number | null = null;
  for (const match of text.matchAll(GUEST_COUNT_RE)) {
    const index = match.index ?? 0;
    const before = text.charAt(index - 1);
    if (before === "-") continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > 0 && n <= 30) last = n;
  }
  return last;
}

function parseMoneyValues(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(MONEY_INLINE_RE)) {
    const n = parseMoneyToken(match[1]);
    if (n !== null) values.push(n);
  }
  return values;
}

function normalizeDateToken(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim().toLowerCase().replace(/\.$/, "");
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;

  const deMatch = raw.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ.]+)\s+de\s+(\d{4})$/i);
  const plainMatch = raw.match(/^(\d{1,2})\s+([a-záéíóúñ.]+)\s+(\d{4})$/i);
  const match = deMatch ?? plainMatch;
  if (!match) return null;

  const day = Number(match[1]);
  const monthKey = match[2].replace(/\./g, "");
  const year = Number(match[3]);
  const month = MONTHS[monthKey];
  if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null;

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function extractListingName(text: string, merged: Record<string, string>): string | null {
  const fromMerged = normalizeVisibleListingName(merged.listingName);
  if (fromMerged) return fromMerged;

  const direct = text.match(LISTING_LABEL_RE)?.[1];
  const fromLabel = normalizeVisibleListingName(direct);
  if (fromLabel) return fromLabel;

  return null;
}

function extractCheckDate(
  text: string,
  merged: Record<string, string>,
  mode: "in" | "out",
): string | null {
  const mergedDate = mode === "in" ? merged.checkIn : merged.checkOut;
  const normalizedMerged = normalizeDateToken(mergedDate);
  if (normalizedMerged) return normalizedMerged;

  const re = mode === "in" ? CHECKIN_RE : CHECKOUT_RE;
  const lineValue = text.match(re)?.[1] ?? null;
  const fromLine = normalizeDateToken(lineValue);
  if (fromLine) return fromLine;

  const token = lineValue?.match(DATE_TOKEN_RE)?.[1] ?? null;
  const fromToken = normalizeDateToken(token);
  if (fromToken) return fromToken;
  return null;
}

export function buildEmailBody(payload: {
  html?: string | null;
  text?: string | null;
  subject: string;
}): string {
  const text = payload.text?.trim();
  const html = payload.html?.trim();
  const htmlText = html ? stripHtmlToText(html) : "";

  if (html) {
    airbnbEmailLog.info("html_payload_detected", {
      htmlBytes: html.length,
      textBytes: text?.length ?? 0,
      richness: htmlPayloadRichness(html),
      degradedPlainText: text ? isDegradedForwardPlainText(text) : true,
    });
  }

  if (!text && htmlText) {
    return normalizeAirbnbForwardedText(`${payload.subject}\n${htmlText}`);
  }

  if (text && htmlText && isDegradedForwardPlainText(text)) {
    return normalizeAirbnbForwardedText(
      `${payload.subject}\n${text}\n${htmlText}`,
    );
  }

  if (text) return normalizeAirbnbForwardedText(`${payload.subject}\n${text}`);
  if (htmlText) return normalizeAirbnbForwardedText(`${payload.subject}\n${htmlText}`);
  return normalizeAirbnbForwardedText(payload.subject);
}

export function extractReservationSignals(input: {
  subject: string;
  body: string;
  html?: string | null;
}): ExtractedReservationSignals {
  const normalizedBody = normalizeAirbnbForwardedText(input.body);
  const labeled = extractLabeledValues(normalizedBody);
  const htmlText = input.html ? stripHtmlToText(input.html) : "";
  const labeledHtml = htmlText ? extractLabeledValues(htmlText) : {};
  const structured = extractStructuredAirbnbFields(input.html);
  const merged: Record<string, string> = { ...labeled, ...labeledHtml };
  if (structured.listingName) merged.listingName = structured.listingName;
  if (structured.checkIn) merged.checkIn = structured.checkIn;
  if (structured.checkOut) merged.checkOut = structured.checkOut;
  if (structured.guestName) merged.guestName = structured.guestName;
  if (structured.confirmationCode) {
    merged.confirmationCode = structured.confirmationCode;
  }
  const extractionText = normalizeAirbnbForwardedText(
    [input.subject, normalizedBody, htmlText].filter(Boolean).join("\n"),
  );

  if (structured.listingName) {
    airbnbEmailLog.info("structured_listing_extracted", {
      listingName: structured.listingName,
      selectedText: structured.listingName,
      sources: structured.sources.join(","),
    });
    airbnbEmailLog.info("listing_normalized", {
      raw: structured.listingName,
      normalized: normalizeListingNameForMatch(structured.listingName),
    });
  }
  if (structured.checkIn || structured.checkOut) {
    airbnbEmailLog.info("structured_dates_extracted", {
      checkIn: structured.checkIn ?? undefined,
      checkOut: structured.checkOut ?? undefined,
      sources: structured.sources.join(","),
    });
  }

  const confirmation =
    input.subject.match(CONFIRMATION_CODE_RE) ??
    extractionText.match(CONFIRMATION_CODE_RE) ??
    merged.confirmationCode?.match(CONFIRMATION_CODE_RE);

  const dateRange =
    extractionText.match(DATE_RANGE_RE) ??
    extractionText.match(ISO_DATE_RANGE_RE);
  const money = parseMoneyValues(extractionText);
  const rating = extractionText.match(RATING_RE);
  let bodyGuestMatch: string | null = null;
  for (const match of extractionText.matchAll(GUEST_NAME_RE)) {
    const candidate = match[1]?.trim();
    if (candidate) bodyGuestMatch = candidate;
  }
  const guestName = resolveGuestNameFromSignals({
    subject: input.subject,
    mergedGuestName: merged.guestName,
    bodyGuestMatch,
  });
  const listingRefs = extractAirbnbListingRefs(
    [input.html ?? "", extractionText].filter(Boolean).join("\n"),
  );
  const unitNumber =
    merged.unitNumber?.trim() ??
    extractionText.match(UNIT_NUMBER_RE)?.[1]?.trim() ??
    null;
  const listingName =
    normalizeVisibleListingName(structured.listingName) ??
    extractListingName(extractionText, merged);

  if (listingName && !isPlausibleVisibleListingName(listingName)) {
    airbnbEmailLog.warn("structured_listing_rejected", {
      candidate: listingName,
      reason: "not_plausible_visible_listing",
    });
  }
  const checkIn =
    extractCheckDate(extractionText, merged, "in") ??
    normalizeDateToken(structured.checkIn) ??
    normalizeDateToken(dateRange?.[1]) ??
    null;
  const checkOut =
    extractCheckDate(extractionText, merged, "out") ??
    normalizeDateToken(structured.checkOut) ??
    normalizeDateToken(dateRange?.[2]) ??
    null;
  const guestEmail = extractGuestEmail(extractionText);
  const guestPhone = extractGuestPhone(extractionText, merged);
  const guestCount = parseGuestCount(extractionText, merged);
  const messageBody =
    extractMessageSnippet(extractionText) ?? extractionText.slice(0, 8000);
  const reviewText = extractReviewText(extractionText);

  return {
    confirmationCode: confirmation?.[1]?.toUpperCase() ?? null,
    listingName:
      listingName && isPlausibleVisibleListingName(listingName)
        ? listingName
        : null,
    guestName: guestName ?? null,
    guestEmail,
    guestPhone,
    guestCount,
    checkIn,
    checkOut,
    grossAmount:
      parseMoneyToken(merged.grossAmount) ?? money[0] ?? null,
    hostFee: parseMoneyToken(merged.hostFee) ?? money[1] ?? null,
    netPayout:
      parseMoneyToken(merged.netPayout) ??
      money[2] ??
      money[money.length - 1] ??
      null,
    currency: /\bUSD\b/i.test(extractionText)
      ? "USD"
      : /\bCOP\b/i.test(extractionText)
        ? "COP"
        : /\bEUR\b/i.test(extractionText)
          ? "EUR"
          : null,
    payoutSettlementDate: merged.settlementDate ?? null,
    payoutAccountId: merged.payoutAccount ?? null,
    rating: rating ? Number(rating[1]) : null,
    reviewText,
    messageBody,
    airbnbRoomId: listingRefs.airbnbRoomId,
    airbnbRoomIdNumeric: listingRefs.airbnbRoomIdNumeric,
    airbnbRoomSlugs: listingRefs.airbnbRoomSlugs,
    airbnbListingUrl: listingRefs.airbnbListingUrl,
    emailMatchBlob: buildEmailMatchBlob({
      subject: input.subject,
      body: normalizedBody,
      html: input.html,
    }),
    unitNumber,
  };
}

function normalizeForIdempotency(text: string): string {
  return text
    .replace(/^(fwd|re):\s*/gim, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function hashEmailContent(input: {
  messageId?: string | null;
  from: string;
  subject: string;
  body: string;
  organizationId?: string | null;
}): string {
  const base = [
    input.organizationId?.trim() ?? "",
    input.messageId?.trim() ?? "",
    extractEmailAddressForHash(input.from),
    normalizeForIdempotency(input.subject),
    normalizeForIdempotency(input.body),
  ].join("|");

  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(36)}`;
}

function extractEmailAddressForHash(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match?.[1] ?? fromHeader).trim().toLowerCase();
}
