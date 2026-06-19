import {
  isZeroReservationAmount,
  pickAuthoritativeHostRevenueAmount,
  pickReservationAmount,
} from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { isHostPayoutConsistentWithGuestTotal } from "@/modules/airbnb-email/parsing/reservation-financials-extract";
import { extractReservationSignals } from "@/modules/airbnb-email/parsing/extractors";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export function readSignalsFromAuditPayload(
  payload: unknown,
): ExtractedReservationSignals | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const signals = (payload as Record<string, unknown>).signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  return signals as ExtractedReservationSignals;
}

/** Solo host/net cuentan como señal financiera completa; bruto requiere re-parse del HTML. */
export function hasAuthoritativeHostFinancialSignals(
  signals: ExtractedReservationSignals,
): boolean {
  const host = pickAuthoritativeHostRevenueAmount(signals);
  if (host != null) return true;
  return (signals.netPayout ?? 0) > 0;
}

function storedHostSignalsAreTrustworthy(
  signals: ExtractedReservationSignals,
): boolean {
  const host = signals.hostPayoutAmount ?? 0;
  const net = signals.netPayout ?? 0;
  if (host <= 0 && net <= 0) return false;

  const guestRef = signals.guestTotalPaid ?? signals.grossAmount ?? null;
  if (guestRef == null || guestRef <= 0) return false;

  return isHostPayoutConsistentWithGuestTotal({
    hostPayoutAmount: host > 0 ? host : net,
    guestTotalPaid: signals.guestTotalPaid,
    grossAmount: signals.grossAmount,
  });
}

/** @deprecated Use hasAuthoritativeHostFinancialSignals */
export function hasPositiveReservationFinancialSignals(
  signals: ExtractedReservationSignals,
): boolean {
  return hasAuthoritativeHostFinancialSignals(signals);
}

function readRawEmailFields(rawEmail: unknown): {
  subject: string;
  body: string;
  html: string | null;
} | null {
  if (!rawEmail || typeof rawEmail !== "object" || Array.isArray(rawEmail)) {
    return null;
  }
  const raw = rawEmail as Record<string, unknown>;
  return {
    subject: typeof raw.subject === "string" ? raw.subject : "",
    body: typeof raw.text === "string" ? raw.text : "",
    html: typeof raw.html === "string" ? raw.html : null,
  };
}

/** Re-parse stored raw email when parsed signals lack host payout (e.g. footer $0 net). */
export function refreshAuditSignalsFromRaw(input: {
  parsedPayload: unknown;
  rawEmail: unknown;
  subject: string | null;
}): ExtractedReservationSignals | null {
  const stored = readSignalsFromAuditPayload(input.parsedPayload);
  if (stored && storedHostSignalsAreTrustworthy(stored)) {
    return stored;
  }

  const rawFields = readRawEmailFields(input.rawEmail);
  if (!rawFields) return stored;

  const fresh = extractReservationSignals({
    subject: rawFields.subject || input.subject || "",
    body: rawFields.body,
    html: rawFields.html,
  });

  if (!stored) return fresh;

  return {
    ...stored,
    ...fresh,
    confirmationCode: fresh.confirmationCode ?? stored.confirmationCode,
    guestName: fresh.guestName ?? stored.guestName,
    checkIn: fresh.checkIn ?? stored.checkIn,
    checkOut: fresh.checkOut ?? stored.checkOut,
  };
}

export function readStoredReservationAmount(value: unknown): number {
  if (value == null) return 0;
  const n =
    typeof value === "object" && value !== null && "toNumber" in value
      ? Number((value as { toNumber: () => number }).toNumber())
      : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function reservationNeedsAmountSync(input: {
  storedTotalAmount: unknown;
  authoritativeAmount: number | null;
}): boolean {
  if (input.authoritativeAmount == null || input.authoritativeAmount <= 0) {
    return false;
  }
  if (isZeroReservationAmount(input.storedTotalAmount)) return true;
  const stored = readStoredReservationAmount(input.storedTotalAmount);
  return Math.abs(stored - input.authoritativeAmount) >= 1;
}

export function reservationNeedsFinancialBackfill(totalAmount: unknown): boolean {
  return isZeroReservationAmount(totalAmount);
}
