import {
  AirbnbEmailEventKind,
  AirbnbEmailProcessingStatus,
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { db } from "@/lib/db";

const UNLINKED_STALE_HOURS = 24;
const SAMPLE_LIMIT = 8;

export type AirbnbEnrichmentHealthSnapshot = {
  unlinkedAuditsOlderThan24h: number;
  unlinkedAuditsSampleIds: string[];
  placeholderZeroAmountActive: number;
  placeholderZeroAmountSampleReservationIds: string[];
  activeAirbnbWithoutEmailEvent: number;
  activeAirbnbWithoutEmailEventSampleIds: string[];
  misclassifiedCanceledConfirmSubject: number;
};

/**
 * Read-only health metrics for cron observability. Does not mutate data.
 */
export async function collectAirbnbEnrichmentHealthSnapshot(input?: {
  organizationId?: string;
}): Promise<AirbnbEnrichmentHealthSnapshot> {
  const staleBefore = new Date(Date.now() - UNLINKED_STALE_HOURS * 60 * 60 * 1000);
  const orgId = input?.organizationId?.trim();

  const unlinkedWhere = {
    reservationId: null as null,
    classification: {
      in: [
        AirbnbEmailEventKind.CONFIRMED,
        AirbnbEmailEventKind.UPDATED,
        AirbnbEmailEventKind.EXTENDED,
        AirbnbEmailEventKind.CHECKIN_REMINDER,
      ],
    },
    processingStatus: {
      in: [
        AirbnbEmailProcessingStatus.CLASSIFIED,
        AirbnbEmailProcessingStatus.PROCESSED,
        AirbnbEmailProcessingStatus.MANUAL_REVIEW,
      ],
    },
    createdAt: { lt: staleBefore },
    ...(orgId ? { organizationId: orgId } : {}),
  };

  const [unlinkedCount, unlinkedSample] = await Promise.all([
    db.emailIngestionAudit.count({ where: unlinkedWhere }),
    db.emailIngestionAudit.findMany({
      where: unlinkedWhere,
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: SAMPLE_LIMIT,
    }),
  ]);

  const activeReservationWhere = {
    platform: BookingPlatform.AIRBNB,
    status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.CHECKED_OUT] },
    checkOut: { gte: new Date(Date.now() - 7 * 86400000) },
    ...(orgId ? { property: { organizationId: orgId } } : {}),
  };

  const activeReservations = await db.reservation.findMany({
    where: activeReservationWhere,
    select: { id: true, guestName: true, totalAmount: true },
  });

  const placeholderZero = activeReservations.filter(
    (row) =>
      isPlaceholderGuestName(row.guestName) && Number(row.totalAmount) === 0,
  );

  const activeIds = activeReservations.map((row) => row.id);
  const withEvents =
    activeIds.length === 0
      ? []
      : await db.reservationEmailEvent.findMany({
          where: { reservationId: { in: activeIds } },
          select: { reservationId: true },
          distinct: ["reservationId"],
        });
  const withEventIds = new Set(withEvents.map((row) => row.reservationId));
  const withoutEvents = activeReservations.filter((row) => !withEventIds.has(row.id));

  const misclassifiedWhere = {
    classification: AirbnbEmailEventKind.CANCELED,
    subject: { contains: "confirmada", mode: "insensitive" as const },
    ...(orgId ? { organizationId: orgId } : {}),
  };

  const misclassifiedCanceledConfirmSubject = await db.emailIngestionAudit.count({
    where: misclassifiedWhere,
  });

  return {
    unlinkedAuditsOlderThan24h: unlinkedCount,
    unlinkedAuditsSampleIds: unlinkedSample.map((row) => row.id),
    placeholderZeroAmountActive: placeholderZero.length,
    placeholderZeroAmountSampleReservationIds: placeholderZero
      .slice(0, SAMPLE_LIMIT)
      .map((row) => row.id),
    activeAirbnbWithoutEmailEvent: withoutEvents.length,
    activeAirbnbWithoutEmailEventSampleIds: withoutEvents
      .slice(0, SAMPLE_LIMIT)
      .map((row) => row.id),
    misclassifiedCanceledConfirmSubject,
  };
}

export async function logAirbnbEnrichmentHealthSnapshot(input?: {
  organizationId?: string;
}): Promise<AirbnbEnrichmentHealthSnapshot> {
  const snapshot = await collectAirbnbEnrichmentHealthSnapshot(input);
  airbnbEmailLog.info("enrichment_health_snapshot", {
    unlinkedAuditsOlderThan24h: snapshot.unlinkedAuditsOlderThan24h,
    placeholderZeroAmountActive: snapshot.placeholderZeroAmountActive,
    activeAirbnbWithoutEmailEvent: snapshot.activeAirbnbWithoutEmailEvent,
    misclassifiedCanceledConfirmSubject: snapshot.misclassifiedCanceledConfirmSubject,
    unlinkedAuditsSampleIds: snapshot.unlinkedAuditsSampleIds.join(",") || undefined,
    placeholderZeroAmountSampleReservationIds:
      snapshot.placeholderZeroAmountSampleReservationIds.join(",") || undefined,
    activeAirbnbWithoutEmailEventSampleIds:
      snapshot.activeAirbnbWithoutEmailEventSampleIds.join(",") || undefined,
  });
  return snapshot;
}
