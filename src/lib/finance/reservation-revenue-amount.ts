import { extractReservationFinancialSignals } from "@/modules/airbnb-email/parsing/reservation-financials-extract";
import type { FinanceRevenueEmailEventRow } from "@/lib/finance/reservation-finance-trace";
import {
  isReservationFinanceTraceable,
  pickFinanceRevenueEmailEvents,
} from "@/lib/finance/reservation-finance-trace";
import type { BookingPlatform } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

export type ReservationRevenueSources = {
  enrichedFields?: unknown;
  payloadSignals?: unknown;
  emailMatchBlob?: string | null;
  payoutNet?: unknown;
};

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

function readPayloadSignals(payload: unknown): JsonRecord {
  return asRecord(asRecord(payload).signals);
}

const EMPTY_FINANCIALS = {
  guestTotalPaid: null,
  hostPayoutAmount: null,
  currency: null,
  nightCount: null,
};

/** Unifica las mismas fuentes que usa el panel de reserva Airbnb. */
export function mergeReservationRevenueSources(
  sources: ReservationRevenueSources,
): JsonRecord {
  const enriched = asRecord(sources.enrichedFields);
  const signals = asRecord(sources.payloadSignals);
  const financials = sources.emailMatchBlob
    ? extractReservationFinancialSignals(sources.emailMatchBlob)
    : EMPTY_FINANCIALS;

  return {
    ...signals,
    ...enriched,
    hostPayoutAmount:
      enriched.hostPayoutAmount ??
      signals.hostPayoutAmount ??
      financials.hostPayoutAmount,
    netPayout:
      enriched.netPayout ??
      signals.netPayout ??
      sources.payoutNet ??
      null,
    grossAmount: enriched.grossAmount ?? signals.grossAmount ?? null,
    guestTotalPaid:
      enriched.guestTotalPaid ??
      signals.guestTotalPaid ??
      financials.guestTotalPaid,
  };
}

function readFromMergedSources(sources: ReservationRevenueSources): number | null {
  return readFromJson(mergeReservationRevenueSources(sources));
}

function readFromJson(source: unknown): number | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as JsonRecord;
  return (
    readNumber(record.hostPayoutAmount) ??
    readNumber(record.netPayout) ??
    readNumber(record.grossAmount) ??
    readNumber(record.guestTotalPaid) ??
    null
  );
}

/** Monto contable: ingreso del anfitrión (email Airbnb) prevalece sobre totalAmount persistido desactualizado. */
export function resolveReservationRevenueAmount(input: {
  totalAmount: unknown;
  enrichedFields?: unknown;
  payloadSignals?: unknown;
  emailMatchBlob?: string | null;
  payoutNet?: unknown;
}): number {
  const sources: ReservationRevenueSources = {
    enrichedFields: input.enrichedFields,
    payloadSignals: input.payloadSignals,
    emailMatchBlob: input.emailMatchBlob,
    payoutNet: input.payoutNet,
  };
  const merged = mergeReservationRevenueSources(sources);
  const fromHostPayout =
    readNumber(merged.hostPayoutAmount) ?? readNumber(merged.netPayout);
  if (fromHostPayout != null) return fromHostPayout;

  const stored = readNumber(input.totalAmount);
  if (stored != null) return stored;

  return readFromJson(merged) ?? 0;
}

export function resolveFinanceReservationRevenueAmount(
  reservation: {
    totalAmount: unknown;
    platform: BookingPlatform;
    icalUid?: string | null;
    reservationCode?: string | null;
  },
  sources?: ReservationRevenueSources | null,
): number {
  const amount = resolveReservationRevenueAmount({
    totalAmount: reservation.totalAmount,
    enrichedFields: sources?.enrichedFields,
    payloadSignals: sources?.payloadSignals,
    emailMatchBlob: sources?.emailMatchBlob,
    payoutNet: sources?.payoutNet,
  });
  if (amount <= 0) return 0;

  const stored = readNumber(reservation.totalAmount);
  if (stored != null) return amount;

  if (!sources || !isReservationFinanceTraceable(reservation)) {
    return 0;
  }

  return amount;
}

export function pickLatestEnrichmentByReservation<
  T extends { reservationId: string | null; enrichedFields: unknown },
>(rows: T[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const row of rows) {
    if (!row.reservationId || map.has(row.reservationId)) continue;
    if (row.enrichedFields) map.set(row.reservationId, row.enrichedFields);
  }
  return map;
}

export function buildReservationRevenueSourcesFromEmailEvent(input: {
  enrichedFields: unknown;
  payload: unknown;
}): ReservationRevenueSources {
  const signals = readPayloadSignals(input.payload);
  const emailMatchBlob =
    typeof signals.emailMatchBlob === "string" ? signals.emailMatchBlob : null;

  return {
    enrichedFields: input.enrichedFields,
    payloadSignals: signals,
    emailMatchBlob,
  };
}

export function buildReservationRevenueSourcesMapFromEmailEvents<
  T extends FinanceRevenueEmailEventRow,
>(
  rows: T[],
  reservationStatusById?: Map<string, import("@prisma/client").ReservationStatus>,
): Map<string, ReservationRevenueSources> {
  const map = new Map<string, ReservationRevenueSources>();
  const statusById = reservationStatusById ?? new Map();
  const picked = reservationStatusById
    ? pickFinanceRevenueEmailEvents(rows, statusById)
    : null;

  if (picked) {
    for (const [reservationId, row] of picked) {
      map.set(
        reservationId,
        buildReservationRevenueSourcesFromEmailEvent(row),
      );
    }
    return map;
  }

  for (const row of rows) {
    if (!row.reservationId || map.has(row.reservationId)) continue;
    map.set(
      row.reservationId,
      buildReservationRevenueSourcesFromEmailEvent(row),
    );
  }
  return map;
}
