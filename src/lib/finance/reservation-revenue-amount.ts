import { extractReservationFinancialSignals } from "@/modules/airbnb-email/parsing/reservation-financials-extract";

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

/** Monto contable de una reserva: totalAmount persistido o señales Airbnb enriquecidas. */
export function resolveReservationRevenueAmount(input: {
  totalAmount: unknown;
  enrichedFields?: unknown;
  payloadSignals?: unknown;
  emailMatchBlob?: string | null;
  payoutNet?: unknown;
}): number {
  const stored = readNumber(input.totalAmount);
  if (stored != null) return stored;

  const fromSources = readFromMergedSources({
    enrichedFields: input.enrichedFields,
    payloadSignals: input.payloadSignals,
    emailMatchBlob: input.emailMatchBlob,
    payoutNet: input.payoutNet,
  });
  if (fromSources != null) return fromSources;

  return 0;
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
  T extends {
    reservationId: string | null;
    enrichedFields: unknown;
    payload: unknown;
  },
>(rows: T[]): Map<string, ReservationRevenueSources> {
  const map = new Map<string, ReservationRevenueSources>();
  for (const row of rows) {
    if (!row.reservationId || map.has(row.reservationId)) continue;
    map.set(
      row.reservationId,
      buildReservationRevenueSourcesFromEmailEvent(row),
    );
  }
  return map;
}
