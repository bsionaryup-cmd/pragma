import type { Prisma } from "@prisma/client";
import { AirbnbEmailEventKind } from "@prisma/client";
import { applySafeReservationEnrichment } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { db } from "@/lib/db";
import type {
  ExtractedReservationSignals,
  ReservationMatchResult,
} from "@/modules/airbnb-email/types";

export function isFinancialEventKind(kind: AirbnbEmailEventKind): boolean {
  return kind === AirbnbEmailEventKind.PAYOUT_PROCESSED;
}

function parseSettlementDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) {
    const d = new Date(`${iso}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function persistReservationPayout(input: {
  auditId: string;
  match: ReservationMatchResult;
  signals: ExtractedReservationSignals;
  payload: Prisma.InputJsonValue;
}) {
  const hasAmounts =
    input.signals.grossAmount != null ||
    input.signals.hostFee != null ||
    input.signals.netPayout != null;

  const reconciliationStatus = !input.match.reservationId
    ? "PAYOUT_MISMATCH"
    : input.match.requiresManualReview
      ? "MANUAL_REVIEW"
      : hasAmounts
        ? "MATCHED"
        : "PARTIAL";

  if (input.match.reservationId && input.match.allowReservationEnrichment) {
    await applySafeReservationEnrichment({
      match: input.match,
      signals: input.signals,
      mode: "financial",
    });
  }

  await db.reservationPayout.create({
    data: {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      grossAmount: input.signals.grossAmount ?? undefined,
      hostFee: input.signals.hostFee ?? undefined,
      netPayout: input.signals.netPayout ?? undefined,
      currency: input.signals.currency ?? "COP",
      payoutAccountId: input.signals.payoutAccountId ?? null,
      expectedSettlementAt: parseSettlementDate(
        input.signals.payoutSettlementDate,
      ),
      reconciliationStatus,
      payload: input.payload,
    },
  });
}
