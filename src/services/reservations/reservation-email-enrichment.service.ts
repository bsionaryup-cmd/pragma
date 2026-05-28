import { TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";

export { reservationHasVisibleEmailEnrichment } from "@/lib/airbnb-email/reservation-enrichment-visibility";

export type ReservationEmailEnrichmentDetail = {
  emailEnriched: boolean;
  emailEventCount: number;
  linkedAuditCount: number;
  propertyAuditCount: number;
  reservationCodeFromEmail: string | null;
  lastEventKind: string | null;
  lastMatchConfidence: number | null;
  lastMatchMethod: string | null;
  payoutCount: number;
  latestPayout: {
    gross: string | null;
    hostFee: string | null;
    net: string | null;
    currency: string;
    reconciliationStatus: string | null;
    settlementAt: string | null;
  } | null;
  communicationCount: number;
  pendingCommunicationActions: number;
  latestCommunicationIntent: string | null;
  reviewCount: number;
  latestRating: number | null;
  pendingReviewResponse: boolean;
  pendingTaskCount: number;
  pendingTaskKinds: string[];
  manualReviewPending: boolean;
  lastProcessedAt: string | null;
};

export type ReservationEmailEnrichmentSummary = ReservationEmailEnrichmentDetail;

export async function getReservationEmailEnrichmentSummary(
  scope: TenantDataScope,
  reservationId: string,
): Promise<ReservationEmailEnrichmentDetail | null> {
  await assertReservationInScope(scope, reservationId);

  const [
    events,
    payouts,
    communications,
    reviews,
    tasks,
    audits,
    linkedAuditCount,
    manualReviewAudits,
    reservation,
  ] = await Promise.all([
    db.reservationEmailEvent.findMany({
      where: { reservationId },
      select: {
        enrichedFields: true,
        eventKind: true,
        matchConfidence: true,
        matchMethod: true,
        confirmationCode: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.reservationPayout.findMany({
      where: { reservationId },
      select: {
        grossAmount: true,
        hostFee: true,
        netPayout: true,
        currency: true,
        reconciliationStatus: true,
        expectedSettlementAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.reservationCommunication.findMany({
      where: { reservationId },
      select: { requiresAction: true, parsedIntent: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.reservationReview.findMany({
      where: { reservationId },
      select: { responsePending: true, rating: true, reviewStatus: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.airbnbEmailTask.findMany({
      where: {
        reservationId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
      select: { kind: true },
    }),
    db.emailIngestionAudit.findMany({
      where: { reservationId },
      select: { processedAt: true },
      orderBy: { processedAt: "desc" },
      take: 1,
    }),
    db.emailIngestionAudit.count({
      where: { reservationId },
    }),
    db.emailIngestionAudit.count({
      where: {
        reservationId,
        processingStatus: "MANUAL_REVIEW",
      },
    }),
    db.reservation.findUnique({
      where: { id: reservationId },
      select: { reservationCode: true, propertyId: true },
    }),
  ]);

  const propertyAuditCount = reservation?.propertyId
    ? await db.emailIngestionAudit.count({
        where: {
          propertyId: reservation.propertyId,
          ...(scope.organizationId
            ? { organizationId: scope.organizationId }
            : {}),
          OR: [{ reservationId: null }, { reservationId: { not: reservationId } }],
        },
      })
    : 0;

  const latestEvent = events[0];
  const enrichedEvent = events.find((event) => {
    const fields = event.enrichedFields;
    return (
      fields &&
      typeof fields === "object" &&
      !Array.isArray(fields) &&
      "reservationCode" in fields
    );
  });

  const latestPayout = payouts[0];
  const latestComm = communications[0];

  return {
    emailEnriched:
      Boolean(enrichedEvent) ||
      events.length > 0 ||
      Boolean(latestEvent?.confirmationCode),
    emailEventCount: events.length,
    linkedAuditCount,
    propertyAuditCount,
    reservationCodeFromEmail:
      reservation?.reservationCode ??
      latestEvent?.confirmationCode ??
      null,
    lastEventKind: latestEvent?.eventKind ?? null,
    lastMatchConfidence: latestEvent?.matchConfidence
      ? Number(latestEvent.matchConfidence)
      : null,
    lastMatchMethod: latestEvent?.matchMethod ?? null,
    payoutCount: payouts.length,
    latestPayout: latestPayout
      ? {
          gross: latestPayout.grossAmount?.toString() ?? null,
          hostFee: latestPayout.hostFee?.toString() ?? null,
          net: latestPayout.netPayout?.toString() ?? null,
          currency: latestPayout.currency,
          reconciliationStatus: latestPayout.reconciliationStatus,
          settlementAt:
            latestPayout.expectedSettlementAt?.toISOString() ?? null,
        }
      : null,
    communicationCount: communications.length,
    pendingCommunicationActions: communications.filter((c) => c.requiresAction)
      .length,
    latestCommunicationIntent: latestComm?.parsedIntent ?? null,
    reviewCount: reviews.length,
    latestRating: reviews[0]?.rating ?? null,
    pendingReviewResponse: reviews.some((r) => r.responsePending),
    pendingTaskCount: tasks.length,
    pendingTaskKinds: tasks.map((t) => t.kind),
    manualReviewPending: manualReviewAudits > 0,
    lastProcessedAt: audits[0]?.processedAt?.toISOString() ?? null,
  };
}
