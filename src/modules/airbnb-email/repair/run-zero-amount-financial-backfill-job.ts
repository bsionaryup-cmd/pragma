import { randomUUID } from "node:crypto";
import {
  AirbnbEmailEventKind,
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { invalidateLivePmsCaches } from "@/lib/live-pms-refresh";
import { db } from "@/lib/db";
import { applyFinancialBackfill } from "@/modules/airbnb-email/repair/apply-financial-backfill";

export type RunZeroAmountFinancialBackfillResult = {
  runId: string;
  scanned: number;
  applied: number;
  skipped: number;
  reservationIds: string[];
};

/** Sincroniza totalAmount con payout autoritativo del email (cero o desactualizado). */
export async function runZeroAmountFinancialBackfillJob(input?: {
  organizationId?: string;
  limit?: number;
  runId?: string;
  dryRun?: boolean;
}): Promise<RunZeroAmountFinancialBackfillResult> {
  const runId = input?.runId ?? randomUUID();
  const limit = input?.limit ?? 80;
  const orgId = input?.organizationId?.trim();
  const dryRun = input?.dryRun ?? false;

  airbnbEmailLog.info("zero_amount_financial_backfill_started", {
    runId,
    organizationId: orgId,
    limit,
    dryRun,
  });

  const candidates = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      ...(orgId ? { property: { organizationId: orgId } } : {}),
      emailEvents: {
        some: {
          eventKind: {
            in: [
              AirbnbEmailEventKind.CONFIRMED,
              AirbnbEmailEventKind.UPDATED,
              AirbnbEmailEventKind.EXTENDED,
              AirbnbEmailEventKind.CHECKIN_REMINDER,
            ],
          },
        },
      },
    },
    select: { id: true, totalAmount: true },
    orderBy: { checkIn: "desc" },
    take: limit,
  });

  const result: RunZeroAmountFinancialBackfillResult = {
    runId,
    scanned: candidates.length,
    applied: 0,
    skipped: 0,
    reservationIds: [],
  };

  for (const reservation of candidates) {
    if (dryRun) {
      result.applied += 1;
      result.reservationIds.push(reservation.id);
      continue;
    }

    const backfill = await applyFinancialBackfill({
      runId,
      reservationId: reservation.id,
    });
    if (backfill.status === "applied") {
      result.applied += 1;
      result.reservationIds.push(reservation.id);
    } else {
      result.skipped += 1;
    }
  }

  if (!dryRun && result.applied > 0) {
    invalidateLivePmsCaches("reservation_linkage");
  }

  airbnbEmailLog.info("zero_amount_financial_backfill_done", {
    runId,
    scanned: result.scanned,
    applied: result.applied,
    skipped: result.skipped,
  });

  return result;
}
