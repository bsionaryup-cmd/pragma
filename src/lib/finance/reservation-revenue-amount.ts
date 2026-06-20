import type { FinanceRevenueEmailEventRow } from "@/lib/finance/reservation-finance-trace";
import {
  isReservationFinanceTraceable,
  pickFinanceRevenueEmailEventsByQuality,
  type FinanceRevenueEmailEventWithAudit,
  type FinanceRevenueReservationMeta,
} from "@/lib/finance/reservation-finance-trace";
import {
  resolveAuthoritativeHostPayout,
  type ResolveAuthoritativeHostPayoutInput,
} from "@/lib/finance/resolve-authoritative-host-payout";
import { isHostPayoutConsistentWithGuestTotal } from "@/modules/airbnb-email/parsing/reservation-financials-extract";
import type { BookingPlatform } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

export type ReservationRevenueSources = {
  enrichedFields?: unknown;
  payloadSignals?: unknown;
  emailMatchBlob?: string | null;
  emailHtml?: string | null;
  emailText?: string | null;
  payoutNet?: unknown;
  confirmationCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
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

function buildResolveInput(
  sources: ReservationRevenueSources,
): ResolveAuthoritativeHostPayoutInput {
  const enriched = asRecord(sources.enrichedFields);
  const signals = asRecord(sources.payloadSignals);
  const emailMatchBlob =
    sources.emailMatchBlob ??
    (typeof signals.emailMatchBlob === "string" ? signals.emailMatchBlob : null);

  return {
    confirmationCode: sources.confirmationCode,
    checkIn: sources.checkIn,
    checkOut: sources.checkOut,
    emailMatchBlob,
    emailHtml: sources.emailHtml,
    emailText: sources.emailText,
    payloadSignals: signals,
    enrichedFields: enriched,
  };
}

function hadEmailSources(sources: ReservationRevenueSources): boolean {
  const signals = asRecord(sources.payloadSignals);
  return Boolean(
    sources.emailMatchBlob ||
      sources.emailHtml ||
      sources.emailText ||
      (typeof signals.emailMatchBlob === "string" && signals.emailMatchBlob),
  );
}

/** Unifica las mismas fuentes que usa el panel de reserva Airbnb. */
export function mergeReservationRevenueSources(
  sources: ReservationRevenueSources,
): JsonRecord {
  const enriched = asRecord(sources.enrichedFields);
  const signals = asRecord(sources.payloadSignals);
  const reconciledFinancials = resolveAuthoritativeHostPayout(
    buildResolveInput(sources),
  );

  const merged = {
    ...signals,
    ...enriched,
    hostPayoutAmount: reconciledFinancials.hostPayoutAmount,
    netPayout:
      enriched.netPayout ??
      signals.netPayout ??
      sources.payoutNet ??
      null,
    grossAmount:
      reconciledFinancials.guestTotalPaid ??
      enriched.grossAmount ??
      signals.grossAmount ??
      null,
    guestTotalPaid:
      reconciledFinancials.guestTotalPaid ??
      enriched.guestTotalPaid ??
      signals.guestTotalPaid,
  };

  const host = readNumber(merged.hostPayoutAmount);
  if (
    host != null &&
    !isHostPayoutConsistentWithGuestTotal({
      hostPayoutAmount: host,
      guestTotalPaid: readNumber(merged.guestTotalPaid),
      grossAmount: readNumber(merged.grossAmount),
    })
  ) {
    return { ...merged, hostPayoutAmount: null };
  }
  return merged;
}

function readHostRevenueFromJson(source: unknown): number | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as JsonRecord;
  return readNumber(record.hostPayoutAmount) ?? readNumber(record.netPayout) ?? null;
}

/** Monto contable: ingreso del anfitrión (email Airbnb) prevalece sobre totalAmount persistido desactualizado. */
export function resolveReservationRevenueAmount(input: {
  totalAmount: unknown;
  enrichedFields?: unknown;
  payloadSignals?: unknown;
  emailMatchBlob?: string | null;
  emailHtml?: string | null;
  emailText?: string | null;
  payoutNet?: unknown;
  confirmationCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
}): number {
  const payloadSignals = asRecord(input.payloadSignals);
  const emailMatchBlob =
    input.emailMatchBlob ??
    (typeof payloadSignals.emailMatchBlob === "string"
      ? payloadSignals.emailMatchBlob
      : null);
  const sources: ReservationRevenueSources = {
    enrichedFields: input.enrichedFields,
    payloadSignals: input.payloadSignals,
    emailMatchBlob,
    emailHtml: input.emailHtml,
    emailText: input.emailText,
    payoutNet: input.payoutNet,
    confirmationCode: input.confirmationCode,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
  };
  const merged = mergeReservationRevenueSources(sources);
  const fromHostPayout =
    readNumber(merged.hostPayoutAmount) ?? readNumber(merged.netPayout);
  if (fromHostPayout != null) return fromHostPayout;

  if (hadEmailSources(sources)) return 0;

  const stored = readNumber(input.totalAmount);
  if (stored != null) return stored;

  return readHostRevenueFromJson(merged) ?? 0;
}

export function resolveFinanceReservationRevenueAmount(
  reservation: {
    totalAmount: unknown;
    platform: BookingPlatform;
    icalUid?: string | null;
    reservationCode?: string | null;
    checkIn?: Date | string | null;
    checkOut?: Date | string | null;
  },
  sources?: ReservationRevenueSources | null,
): number {
  const checkIn =
    reservation.checkIn instanceof Date
      ? reservation.checkIn.toISOString().slice(0, 10)
      : typeof reservation.checkIn === "string"
        ? reservation.checkIn.slice(0, 10)
        : sources?.checkIn ?? null;
  const checkOut =
    reservation.checkOut instanceof Date
      ? reservation.checkOut.toISOString().slice(0, 10)
      : typeof reservation.checkOut === "string"
        ? reservation.checkOut.slice(0, 10)
        : sources?.checkOut ?? null;

  const amount = resolveReservationRevenueAmount({
    totalAmount: reservation.totalAmount,
    enrichedFields: sources?.enrichedFields,
    payloadSignals: sources?.payloadSignals,
    emailMatchBlob: sources?.emailMatchBlob,
    emailHtml: sources?.emailHtml,
    emailText: sources?.emailText,
    payoutNet: sources?.payoutNet,
    confirmationCode: reservation.reservationCode ?? sources?.confirmationCode ?? null,
    checkIn,
    checkOut,
  });
  if (amount <= 0) return 0;

  const stored = readNumber(reservation.totalAmount);
  if (stored != null) return amount;

  if (
    !sources ||
    !isReservationFinanceTraceable({
      ...reservation,
      emailRevenueAmount: amount,
    })
  ) {
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
  confirmationCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  emailHtml?: string | null;
  emailText?: string | null;
}): ReservationRevenueSources {
  const signals = readPayloadSignals(input.payload);
  const emailMatchBlob =
    typeof signals.emailMatchBlob === "string" ? signals.emailMatchBlob : null;

  return {
    enrichedFields: input.enrichedFields,
    payloadSignals: signals,
    emailMatchBlob,
    emailHtml: input.emailHtml ?? null,
    emailText: input.emailText ?? null,
    confirmationCode:
      input.confirmationCode ??
      (typeof signals.confirmationCode === "string"
        ? signals.confirmationCode
        : null),
    checkIn: input.checkIn ?? (typeof signals.checkIn === "string" ? signals.checkIn : null),
    checkOut:
      input.checkOut ?? (typeof signals.checkOut === "string" ? signals.checkOut : null),
  };
}

export function buildReservationRevenueSourcesMapFromEmailEvents<
  T extends FinanceRevenueEmailEventWithAudit,
>(
  rows: T[],
  reservationStatusById?: Map<string, import("@prisma/client").ReservationStatus>,
  reservationMetaById?: Map<string, FinanceRevenueReservationMeta>,
): Map<string, ReservationRevenueSources> {
  const map = new Map<string, ReservationRevenueSources>();
  const statusById = reservationStatusById ?? new Map();
  const metaById = reservationMetaById ?? new Map();

  if (reservationStatusById) {
    const picked = pickFinanceRevenueEmailEventsByQuality(
      rows,
      statusById,
      metaById,
    );
    for (const [reservationId, row] of picked) {
      const meta = metaById.get(reservationId);
      const raw = row.rawEmail;
      map.set(
        reservationId,
        buildReservationRevenueSourcesFromEmailEvent({
          enrichedFields: row.enrichedFields,
          payload: row.payload,
          confirmationCode: meta?.reservationCode ?? null,
          checkIn: meta?.checkIn ?? null,
          checkOut: meta?.checkOut ?? null,
          emailHtml: raw?.html ?? null,
          emailText: raw?.text ?? null,
        }),
      );
    }
    return map;
  }

  for (const row of rows) {
    if (!row.reservationId || map.has(row.reservationId)) continue;
    const raw = row.rawEmail;
    map.set(
      row.reservationId,
      buildReservationRevenueSourcesFromEmailEvent({
        enrichedFields: row.enrichedFields,
        payload: row.payload,
        emailHtml: raw?.html ?? null,
        emailText: raw?.text ?? null,
      }),
    );
  }
  return map;
}
