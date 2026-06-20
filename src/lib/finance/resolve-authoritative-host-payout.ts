import { stripHtmlToText } from "@/modules/airbnb-email/parsing/html-parse";
import {
  extractReservationFinancialSignals,
  preferBlobFinancialsOverInconsistentSignals,
  sanitizeHostPayoutAgainstGuestTotal,
  type ReservationFinancialScope,
  type ReservationFinancialSignals,
} from "@/modules/airbnb-email/parsing/reservation-financials-extract";

type JsonRecord = Record<string, unknown>;

export type ResolveAuthoritativeHostPayoutInput = {
  confirmationCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  emailMatchBlob?: string | null;
  emailHtml?: string | null;
  emailText?: string | null;
  payloadSignals?: unknown;
  enrichedFields?: unknown;
};

const EMPTY_FINANCIALS: ReservationFinancialSignals = {
  guestTotalPaid: null,
  hostPayoutAmount: null,
  currency: null,
  nightCount: null,
};

const HTML_MARKER_RE = /<(?:html|table|div|td|tr|body)\b/i;

function readNumber(value: unknown): number | null {
  if (value == null) return null;
  const n =
    typeof value === "object" && value !== null && "toNumber" in value
      ? Number((value as { toNumber: () => number }).toNumber())
      : typeof value === "number"
        ? value
        : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildFinancialScope(
  input: ResolveAuthoritativeHostPayoutInput,
  signals: JsonRecord,
): ReservationFinancialScope {
  return {
    confirmationCode:
      readString(input.confirmationCode) ??
      readString(signals.confirmationCode)?.toUpperCase() ??
      null,
    checkIn: readString(input.checkIn) ?? readString(signals.checkIn),
    checkOut: readString(input.checkOut) ?? readString(signals.checkOut),
    html: readString(input.emailHtml),
  };
}

function readSignalFinancials(
  signals: JsonRecord,
  enriched: JsonRecord,
): ReservationFinancialSignals {
  return {
    guestTotalPaid: readNumber(signals.guestTotalPaid ?? enriched.guestTotalPaid),
    hostPayoutAmount: readNumber(
      enriched.hostPayoutAmount ?? signals.hostPayoutAmount ?? signals.netPayout,
    ),
    currency:
      readString(signals.currency) ??
      readString(enriched.currency) ??
      null,
    nightCount: readNumber(signals.nightCount ?? enriched.nightCount),
  };
}

function readEmailMatchBlob(
  input: ResolveAuthoritativeHostPayoutInput,
  signals: JsonRecord,
): string | null {
  return (
    input.emailMatchBlob ??
    (typeof signals.emailMatchBlob === "string" ? signals.emailMatchBlob : null)
  );
}

function hasEmailSources(
  input: ResolveAuthoritativeHostPayoutInput,
  emailMatchBlob: string | null,
): boolean {
  return Boolean(
    emailMatchBlob ||
      readString(input.emailHtml) ||
      readString(input.emailText),
  );
}

function parseBlobFinancials(
  emailMatchBlob: string | null,
  scope: ReservationFinancialScope,
  emailHtml?: string | null,
  emailText?: string | null,
): ReservationFinancialSignals {
  if (!emailMatchBlob && !emailHtml && !emailText) return EMPTY_FINANCIALS;

  const blobIsHtml = Boolean(emailMatchBlob && HTML_MARKER_RE.test(emailMatchBlob));
  const html =
    readString(emailHtml) ??
    (blobIsHtml ? emailMatchBlob : null);
  const text =
    readString(emailText) ??
    (emailMatchBlob && !blobIsHtml
      ? emailMatchBlob
      : emailMatchBlob
        ? stripHtmlToText(emailMatchBlob)
        : "");

  return sanitizeHostPayoutAgainstGuestTotal(
    extractReservationFinancialSignals(text, {
      ...scope,
      html,
    }),
  );
}

/**
 * Fuente única de verdad para Ganas del anfitrión.
 * Finanzas, drawer y reconciliación blob vs señales deben usar solo esta función.
 */
export function resolveAuthoritativeHostPayout(
  input: ResolveAuthoritativeHostPayoutInput,
): ReservationFinancialSignals {
  const enriched = asRecord(input.enrichedFields);
  const signals = asRecord(input.payloadSignals);
  const scope = buildFinancialScope(input, signals);
  const emailMatchBlob = readEmailMatchBlob(input, signals);

  const blobFinancials = parseBlobFinancials(
    emailMatchBlob,
    scope,
    input.emailHtml,
    input.emailText,
  );

  const signalFinancials = readSignalFinancials(signals, enriched);
  const emailSourcesPresent = hasEmailSources(input, emailMatchBlob);

  if (blobFinancials.hostPayoutAmount == null) {
    if (emailSourcesPresent) {
      return {
        guestTotalPaid: signalFinancials.guestTotalPaid,
        hostPayoutAmount: null,
        currency: signalFinancials.currency ?? blobFinancials.currency,
        nightCount: signalFinancials.nightCount ?? blobFinancials.nightCount,
      };
    }

    // Sin fuente email: nunca confiar en hostPayoutAmount persistido en signals.
    // Finanzas puede seguir usando totalAmount iCal como valor provisional.
    return {
      guestTotalPaid: signalFinancials.guestTotalPaid,
      hostPayoutAmount: null,
      currency: signalFinancials.currency,
      nightCount: signalFinancials.nightCount,
    };
  }

  return preferBlobFinancialsOverInconsistentSignals({
    signals: signalFinancials,
    blob: blobFinancials,
  });
}
