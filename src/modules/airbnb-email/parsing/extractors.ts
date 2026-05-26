import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import {
  extractLabeledValues,
  extractMessageSnippet,
  extractReviewText,
  stripHtmlToText,
} from "@/modules/airbnb-email/parsing/html-parse";

const CONFIRMATION_CODE_RE = /\b(HM[A-Z0-9]{6,12})\b/i;
const DATE_RANGE_RE =
  /(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+\d{4})\s*(?:→|–|-|to|a)\s*(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+\d{4})/i;
const ISO_DATE_RANGE_RE =
  /(\d{4}-\d{2}-\d{2})\s*(?:→|–|-|to|a)\s*(\d{4}-\d{2}-\d{2})/;
const MONEY_INLINE_RE = /(?:\$|USD|COP|€)\s*([\d.,]+)/gi;
const RATING_RE = /(\d(?:\.\d)?)\s*(?:estrellas|stars|★|\/5)/i;
const GUEST_NAME_RE =
  /(?:huésped|guest)[:\s]+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,60})/i;

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

function parseMoneyValues(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(MONEY_INLINE_RE)) {
    const n = parseMoneyToken(match[1]);
    if (n !== null) values.push(n);
  }
  return values;
}

export function buildEmailBody(payload: {
  html?: string | null;
  text?: string | null;
  subject: string;
}): string {
  const text = payload.text?.trim();
  if (text) return `${payload.subject}\n${text}`;
  const html = payload.html?.trim();
  if (html) return `${payload.subject}\n${stripHtmlToText(html)}`;
  return payload.subject;
}

export function extractReservationSignals(input: {
  subject: string;
  body: string;
  html?: string | null;
}): ExtractedReservationSignals {
  const labeled = extractLabeledValues(input.body);
  const htmlText = input.html ? stripHtmlToText(input.html) : "";
  const labeledHtml = htmlText ? extractLabeledValues(htmlText) : {};
  const merged = { ...labeled, ...labeledHtml };

  const confirmation =
    input.body.match(CONFIRMATION_CODE_RE) ??
    input.subject.match(CONFIRMATION_CODE_RE) ??
    merged.confirmationCode?.match(CONFIRMATION_CODE_RE);

  const dateRange =
    input.body.match(DATE_RANGE_RE) ??
    input.body.match(ISO_DATE_RANGE_RE);
  const money = parseMoneyValues(input.body);
  const rating = input.body.match(RATING_RE);
  const guestName =
    merged.guestName ?? input.body.match(GUEST_NAME_RE)?.[1] ?? null;
  const messageBody =
    extractMessageSnippet(input.body) ?? input.body.slice(0, 8000);
  const reviewText = extractReviewText(input.body);

  return {
    confirmationCode: confirmation?.[1]?.toUpperCase() ?? null,
    listingName: merged.listingName ?? null,
    guestName: guestName?.trim() ?? null,
    guestEmail: null,
    checkIn: merged.checkIn ?? dateRange?.[1] ?? null,
    checkOut: merged.checkOut ?? dateRange?.[2] ?? null,
    grossAmount:
      parseMoneyToken(merged.grossAmount) ?? money[0] ?? null,
    hostFee: parseMoneyToken(merged.hostFee) ?? money[1] ?? null,
    netPayout:
      parseMoneyToken(merged.netPayout) ??
      money[2] ??
      money[money.length - 1] ??
      null,
    currency: /\bUSD\b/i.test(input.body)
      ? "USD"
      : /\bCOP\b/i.test(input.body)
        ? "COP"
        : /\bEUR\b/i.test(input.body)
          ? "EUR"
          : null,
    payoutSettlementDate: merged.settlementDate ?? null,
    payoutAccountId: merged.payoutAccount ?? null,
    rating: rating ? Number(rating[1]) : null,
    reviewText,
    messageBody,
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
