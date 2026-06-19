import {
  AirbnbEmailEventKind,
  AirbnbFinancialBackfillStatus,
  ReservationStatus,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { pickFinanceRevenueEmailEvents } from "@/lib/finance/reservation-finance-trace";
import { db } from "@/lib/db";
import {
  pickAuthoritativeHostRevenueAmount,
  pickReservationAmount,
} from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { confirmationCodesConflict } from "@/modules/airbnb-email/matching/confirmation-code-guard";
import {
  readSignalsFromAuditPayload,
  refreshAuditSignalsFromRaw,
  reservationNeedsAmountSync,
} from "@/modules/airbnb-email/repair/refresh-audit-signals-from-raw";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

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
  auditRawEmail: unknown;
  auditSubject: string | null;
}): ExtractedReservationSignals {
  const refreshed =
    refreshAuditSignalsFromRaw({
      parsedPayload: input.auditPayload,
      rawEmail: input.auditRawEmail,
      subject: input.auditSubject,
    }) ?? readSignalsFromAuditPayload(input.auditPayload) ?? {};
  return {
    ...refreshed,
    netPayout:
      readEnrichedNumber(input.enrichedFields, "netPayout") ??
      refreshed.netPayout ??
      null,
    hostPayoutAmount:
      readEnrichedNumber(input.enrichedFields, "hostPayoutAmount") ??
      refreshed.hostPayoutAmount ??
      null,
    grossAmount:
      readEnrichedNumber(input.enrichedFields, "grossAmount") ??
      refreshed.grossAmount ??
      null,
    guestTotalPaid:
      readEnrichedNumber(input.enrichedFields, "guestTotalPaid") ??
      refreshed.guestTotalPaid ??
      null,
    currency:
      (typeof (input.enrichedFields as Record<string, unknown> | null)?.currency ===
      "string"
        ? String((input.enrichedFields as Record<string, unknown>).currency)
        : null) ??
      refreshed.currency ??
      null,
  };
}

function pickSourceLabel(signals: ExtractedReservationSignals): string | null {
  if (signals.hostPayoutAmount != null && signals.hostPayoutAmount > 0) {
    return "hostPayoutAmount";
  }
  if (signals.netPayout != null && signals.netPayout > 0) return "netPayout";
  if (signals.grossAmount != null && signals.grossAmount > 0) return "grossAmount";
  return null;
}

function pickSyncAmount(signals: ExtractedReservationSignals): number | null {
  return (
    pickAuthoritativeHostRevenueAmount(signals) ?? pickReservationAmount(signals)
  );
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
    select: {
      totalAmount: true,
      currency: true,
      reservationCode: true,
      status: true,
    },
  });
  if (!reservation) {
    return { status: "skipped", reason: "reservation_not_found" };
  }

  const events = await db.reservationEmailEvent.findMany({
    where: { reservationId: input.reservationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      auditId: true,
      reservationId: true,
      eventKind: true,
      confirmationCode: true,
      enrichedFields: true,
      audit: { select: { parsedPayload: true, rawEmail: true, subject: true } },
    },
  });

  const statusById = new Map([
    [input.reservationId, reservation.status ?? ReservationStatus.CONFIRMED],
  ]);
  const bestByFinance = pickFinanceRevenueEmailEvents(events, statusById);
  const orderedEvents = [
    ...(bestByFinance.get(input.reservationId)
      ? [bestByFinance.get(input.reservationId)!]
      : []),
    ...events.filter(
      (event) => event.id !== bestByFinance.get(input.reservationId)?.id,
    ),
  ];

  for (const event of orderedEvents) {
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
      auditRawEmail: event.audit.rawEmail,
      auditSubject: event.audit.subject,
    });
    const amount = pickSyncAmount(signals);
    if (amount == null || amount <= 0) continue;

    if (
      !reservationNeedsAmountSync({
        storedTotalAmount: reservation.totalAmount,
        authoritativeAmount: amount,
      })
    ) {
      return { status: "skipped", reason: "total_amount_already_synced" };
    }

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

  return { status: "skipped", reason: "no_eligible_authoritative_amount" };
}
