import { randomUUID } from "node:crypto";
import { BookingPlatform, ReservationStatus } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { invalidateLivePmsCaches } from "@/lib/live-pms-refresh";
import { db } from "@/lib/db";
import {
  applyPlaceholderGuestNameBackfill,
  CANONICAL_AIRBNB_PLACEHOLDER_GUEST_NAME,
  resolveTrustworthyGuestNameForPlaceholder,
} from "@/modules/airbnb-email/repair/placeholder-guest-name-backfill";

export type PlaceholderGuestNameBackfillDetail = {
  reservationId: string;
  guestName: string;
  source: "email_event" | "ingestion_audit";
  checkIn: string;
  reservationCode: string | null;
};

export type RunPlaceholderGuestNameBackfillResult = {
  runId: string;
  scanned: number;
  applied: number;
  skipped: number;
  details: PlaceholderGuestNameBackfillDetail[];
};

/** Copia nombres confiables de enrichment al row cuando guestName sigue en placeholder canónico. */
export async function runPlaceholderGuestNameBackfillJob(input?: {
  organizationId?: string;
  limit?: number;
  runId?: string;
  dryRun?: boolean;
}): Promise<RunPlaceholderGuestNameBackfillResult> {
  const runId = input?.runId ?? randomUUID();
  const limit = input?.limit ?? 80;
  const orgId = input?.organizationId?.trim();
  const dryRun = input?.dryRun ?? false;

  airbnbEmailLog.info("placeholder_guest_name_backfill_started", {
    runId,
    organizationId: orgId,
    limit,
    dryRun,
  });

  const candidates = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      guestName: CANONICAL_AIRBNB_PLACEHOLDER_GUEST_NAME,
      status: { not: ReservationStatus.CANCELLED },
      guestRegistrationCompletedAt: null,
      ...(orgId ? { property: { organizationId: orgId } } : {}),
    },
    select: {
      id: true,
      reservationCode: true,
      checkIn: true,
      emailEvents: {
        select: {
          eventKind: true,
          confirmationCode: true,
          enrichedFields: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { checkIn: "desc" },
    take: limit,
  });

  const result: RunPlaceholderGuestNameBackfillResult = {
    runId,
    scanned: candidates.length,
    applied: 0,
    skipped: 0,
    details: [],
  };

  for (const reservation of candidates) {
    const audits =
      reservation.emailEvents.length === 0
        ? await db.emailIngestionAudit.findMany({
            where: { reservationId: reservation.id },
            select: { parsedPayload: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : [];

    const resolved = resolveTrustworthyGuestNameForPlaceholder({
      emailEvents: reservation.emailEvents,
      reservationCode: reservation.reservationCode,
      auditPayloads: audits.map((row) => row.parsedPayload),
    });

    if (!resolved) {
      result.skipped += 1;
      continue;
    }

    await applyPlaceholderGuestNameBackfill({
      reservationId: reservation.id,
      guestName: resolved.guestName,
      dryRun,
    });

    result.applied += 1;
    result.details.push({
      reservationId: reservation.id,
      guestName: resolved.guestName,
      source: resolved.source,
      checkIn: reservation.checkIn.toISOString().slice(0, 10),
      reservationCode: reservation.reservationCode,
    });
  }

  if (!dryRun && result.applied > 0) {
    invalidateLivePmsCaches("reservation_linkage");
  }

  airbnbEmailLog.info("placeholder_guest_name_backfill_done", {
    runId,
    scanned: result.scanned,
    applied: result.applied,
    skipped: result.skipped,
    dryRun,
  });

  return result;
}
