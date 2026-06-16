import {
  AirbnbEmailEventKind,
  AirbnbFinancialBackfillStatus,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import {
  isZeroReservationAmount,
  pickReservationAmount,
} from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { confirmationCodesConflict } from "@/modules/airbnb-email/matching/confirmation-code-guard";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

function readSignalsFromAuditPayload(payload: unknown): ExtractedReservationSignals | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const signals = root.signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  return signals as ExtractedReservationSignals;
}

function readEnrichedNumber(
  enrichedFields: unknown,
  field: string,
): number | null {
  if (!enrichedFields || typeof enrichedFields !== "object" || Array.isArray(enrichedFields)) {
    return null;
  }
  const value = (enrichedFields as Record<string, unknown>)[field];
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function signalsFromEventAndAudit(input: {
  enrichedFields: unknown;
  auditPayload: unknown;
}): ExtractedReservationSignals {
  const auditSignals = readSignalsFromAuditPayload(input.auditPayload) ?? {};
  return {
    ...auditSignals,
    netPayout:
      readEnrichedNumber(input.enrichedFields, "netPayout") ??
      auditSignals.netPayout ??
      null,
    hostPayoutAmount:
      readEnrichedNumber(input.enrichedFields, "hostPayoutAmount") ??
      auditSignals.hostPayoutAmount ??
      null,
    grossAmount:
      readEnrichedNumber(input.enrichedFields, "grossAmount") ??
      auditSignals.grossAmount ??
      null,
    guestTotalPaid:
      readEnrichedNumber(input.enrichedFields, "guestTotalPaid") ??
      auditSignals.guestTotalPaid ??
      null,
    currency:
      (typeof (input.enrichedFields as Record<string, unknown> | null)?.currency ===
      "string"
        ? String((input.enrichedFields as Record<string, unknown>).currency)
        : null) ??
      auditSignals.currency ??
      null,
  };
}

function pickSourceLabel(signals: ExtractedReservationSignals): string | null {
  if (signals.netPayout != null && signals.netPayout > 0) return "netPayout";
  if (signals.hostPayoutAmount != null && signals.hostPayoutAmount > 0) {
    return "hostPayoutAmount";
  }
  if (signals.grossAmount != null && signals.grossAmount > 0) return "grossAmount";
  return null;
}

export type ApplyFinancialBackfillResult =
  | { status: "applied"; amount: number; sourceEventId: string; sourceAuditId: string }
  | { status: "skipped"; reason: string };

export async function applyFinancialBackfill(input: {
  runId: string;
  reservationId: string;
}): Promise<ApplyFinancialBackfillResult> {
  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    select: { totalAmount: true, currency: true, reservationCode: true },
  });
  if (!reservation) {
    return { status: "skipped", reason: "reservation_not_found" };
  }
  if (!isZeroReservationAmount(reservation.totalAmount)) {
    return { status: "skipped", reason: "total_amount_not_empty" };
  }

  const events = await db.reservationEmailEvent.findMany({
    where: {
      reservationId: input.reservationId,
      eventKind: AirbnbEmailEventKind.CONFIRMED,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      auditId: true,
      confirmationCode: true,
      enrichedFields: true,
      audit: { select: { parsedPayload: true } },
    },
  });

  for (const event of events) {
    if (
      confirmationCodesConflict(
        event.confirmationCode,
        reservation.reservationCode,
      )
    ) {
      continue;
    }

    const signals = signalsFromEventAndAudit({
      enrichedFields: event.enrichedFields,
      auditPayload: event.audit.parsedPayload,
    });
    const amount = pickReservationAmount(signals);
    if (amount == null || amount <= 0) continue;

    const pickSource = pickSourceLabel(signals);
    const previousTotal = reservation.totalAmount;

    await db.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: input.reservationId },
        data: {
          totalAmount: amount,
          ...(signals.currency?.trim() && !reservation.currency?.trim()
            ? { currency: signals.currency.trim() }
            : {}),
        },
      });
      await tx.airbnbFinancialBackfillLog.create({
        data: {
          runId: input.runId,
          reservationId: input.reservationId,
          sourceEventId: event.id,
          sourceAuditId: event.auditId,
          previousTotalAmount: previousTotal,
          appliedTotalAmount: amount,
          currency: signals.currency?.trim() ?? reservation.currency,
          pickSource,
          status: AirbnbFinancialBackfillStatus.APPLIED,
        },
      });
    });

    airbnbEmailLog.info("linkage_financial_backfill_applied", {
      runId: input.runId,
      reservationId: input.reservationId,
      sourceEventId: event.id,
      amount,
      pickSource: pickSource ?? undefined,
    });

    return {
      status: "applied",
      amount,
      sourceEventId: event.id,
      sourceAuditId: event.auditId,
    };
  }

  return { status: "skipped", reason: "no_eligible_confirmed_amount" };
}
