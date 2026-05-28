import {
  AirbnbEmailEventKind,
  AirbnbEmailMatchMethod,
  AirbnbEmailProcessingStatus,
  TaskStatus,
  type Prisma,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { applyMatchPolicy } from "@/modules/airbnb-email/lib/match-policy";
import { persistReservationMatchLinkage } from "@/modules/airbnb-email/matching/reservation-match-persist";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export { reservationHasVisibleEmailEnrichment } from "@/lib/airbnb-email/reservation-enrichment-visibility";

export type ReservationEmailEnrichmentDetail = {
  emailEnriched: boolean;
  emailEventCount: number;
  linkedAuditCount: number;
  propertyAuditCount: number;
  airbnbGuestName: string | null;
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

export type ManualReservationEnrichmentResult = {
  linkedAuditId: string | null;
  reservationId: string;
  linkedAuditCount: number;
  reservationEmailEventCount: number;
  status: "linked" | "no_candidate";
};

type PendingAuditCandidate = {
  id: string;
  createdAt: Date;
  classification: AirbnbEmailEventKind | null;
  parsedPayload: Prisma.JsonValue | null;
  matchConfidence: Prisma.Decimal | null;
};

function readStringField(record: Prisma.JsonValue | null, field: string): string | null {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const obj = record as Record<string, unknown>;
  const raw = obj[field];
  return typeof raw === "string" ? raw : null;
}

function extractGuestNameFromEvent(event: {
  enrichedFields: Prisma.JsonValue | null;
  payload: Prisma.JsonValue;
}): string | null {
  const fromEnriched = readStringField(event.enrichedFields, "guestName");
  if (fromEnriched?.trim()) return fromEnriched.trim();
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    return null;
  }
  const payload = event.payload as Record<string, unknown>;
  const signals =
    payload.signals && typeof payload.signals === "object" && !Array.isArray(payload.signals)
      ? (payload.signals as Record<string, unknown>)
      : {};
  const fromSignals = signals.guestName;
  return typeof fromSignals === "string" && fromSignals.trim() ? fromSignals.trim() : null;
}

function extractSignalsFromParsedPayload(
  parsedPayload: Prisma.JsonValue | null,
): ExtractedReservationSignals {
  if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
    return {};
  }
  const payload = parsedPayload as Record<string, unknown>;
  const signals =
    payload.signals && typeof payload.signals === "object" && !Array.isArray(payload.signals)
      ? (payload.signals as Record<string, unknown>)
      : {};
  return {
    confirmationCode:
      typeof signals.confirmationCode === "string" ? signals.confirmationCode : null,
    listingName: typeof signals.listingName === "string" ? signals.listingName : null,
    guestName: typeof signals.guestName === "string" ? signals.guestName : null,
    checkIn: typeof signals.checkIn === "string" ? signals.checkIn : null,
    checkOut: typeof signals.checkOut === "string" ? signals.checkOut : null,
    messageBody: typeof signals.messageBody === "string" ? signals.messageBody : null,
  };
}

function dateFromSignal(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!iso) return null;
  const parsed = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function overlapDays(
  reservationCheckIn: Date,
  reservationCheckOut: Date,
  emailCheckIn: Date | null,
  emailCheckOut: Date | null,
): number {
  if (!emailCheckIn) return 0;
  const emailOut = emailCheckOut ?? emailCheckIn;
  const start = Math.max(reservationCheckIn.getTime(), emailCheckIn.getTime());
  const end = Math.min(reservationCheckOut.getTime(), emailOut.getTime());
  if (end < start) return 0;
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function guestMatches(
  reservationGuest: string | null | undefined,
  emailGuest: string | null | undefined,
): boolean {
  if (!reservationGuest?.trim() || !emailGuest?.trim()) return false;
  const reservationLower = reservationGuest.toLowerCase();
  const parts = emailGuest
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  return parts.length > 0 && parts.every((token) => reservationLower.includes(token));
}

function scoreManualCandidate(input: {
  reservation: { checkIn: Date; checkOut: Date; guestName: string | null; reservationCode: string | null };
  signals: ExtractedReservationSignals;
  auditCreatedAt: Date;
  now: Date;
}): {
  score: number;
  overlapDays: number;
  reason: string;
} {
  const emailCheckIn = dateFromSignal(input.signals.checkIn);
  const emailCheckOut = dateFromSignal(input.signals.checkOut);
  const overlap = overlapDays(
    input.reservation.checkIn,
    input.reservation.checkOut,
    emailCheckIn,
    emailCheckOut,
  );
  const hasHmMatch = Boolean(
    input.signals.confirmationCode &&
      input.reservation.reservationCode &&
      input.signals.confirmationCode.trim().toUpperCase() ===
        input.reservation.reservationCode.trim().toUpperCase(),
  );
  const guestMatch = guestMatches(input.reservation.guestName, input.signals.guestName);
  const ageDays = Math.abs(
    (input.now.getTime() - input.auditCreatedAt.getTime()) / (24 * 60 * 60 * 1000),
  );

  let score = 0;
  if (overlap >= 1) score += 70;
  if (hasHmMatch) score += 20;
  if (guestMatch) score += 15;
  if (ageDays <= 7) score += 5;

  const reasonParts: string[] = [];
  if (overlap >= 1) reasonParts.push("date_overlap");
  if (hasHmMatch) reasonParts.push("hm_match");
  if (guestMatch) reasonParts.push("guest_match");
  if (ageDays <= 7) reasonParts.push("recent_email");
  return { score, overlapDays: overlap, reason: reasonParts.join("+") || "weak_candidate" };
}

export async function manualReservationEnrichmentResolver(
  scope: TenantDataScope,
  reservationId: string,
): Promise<ManualReservationEnrichmentResult> {
  const reservation = await assertReservationInScope(scope, reservationId);
  const reservationRow = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      propertyId: true,
      checkIn: true,
      checkOut: true,
      guestName: true,
      reservationCode: true,
      property: { select: { organizationId: true } },
    },
  });
  if (!reservationRow) {
    return {
      status: "no_candidate",
      linkedAuditId: null,
      reservationId,
      linkedAuditCount: 0,
      reservationEmailEventCount: 0,
    };
  }

  const pendingAudits = await db.emailIngestionAudit.findMany({
    where: {
      propertyId: reservation.propertyId,
      reservationId: null,
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      processingStatus: {
        in: [
          AirbnbEmailProcessingStatus.PROCESSED,
          AirbnbEmailProcessingStatus.MANUAL_REVIEW,
          AirbnbEmailProcessingStatus.CLASSIFIED,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      classification: true,
      parsedPayload: true,
      matchConfidence: true,
    },
  });

  if (pendingAudits.length === 0) {
    return {
      status: "no_candidate",
      linkedAuditId: null,
      reservationId,
      linkedAuditCount: 0,
      reservationEmailEventCount: 0,
    };
  }

  const now = new Date();
  const scored = pendingAudits.map((audit: PendingAuditCandidate) => {
    const signals = extractSignalsFromParsedPayload(audit.parsedPayload);
    const scoredCandidate = scoreManualCandidate({
      reservation: reservationRow,
      signals,
      auditCreatedAt: audit.createdAt,
      now,
    });
    return {
      audit,
      signals,
      ...scoredCandidate,
    };
  });

  const best = scored
    .filter((row) => row.overlapDays >= 1 || row.score >= 80)
    .sort((a, b) => b.score - a.score)[0];

  if (!best) {
    airbnbEmailLog.warn("manual_reservation_match_skipped", {
      reservationId,
      propertyId: reservation.propertyId,
      pendingAuditCount: pendingAudits.length,
      reason: "no_reasonable_candidate",
    });
    return {
      status: "no_candidate",
      linkedAuditId: null,
      reservationId,
      linkedAuditCount: 0,
      reservationEmailEventCount: 0,
    };
  }

  const baseMatch = applyMatchPolicy(
    {
      reservationId: reservationId,
      propertyId: reservation.propertyId,
      organizationId: reservationRow.property.organizationId,
      method: AirbnbEmailMatchMethod.LISTING_DATES,
      confidence: best.overlapDays >= 1 ? 0.95 : 0.86,
    },
    { hasConfirmationCodeInEmail: Boolean(best.signals.confirmationCode) },
  );

  const eventKindForPersist =
    best.audit.classification && best.audit.classification !== AirbnbEmailEventKind.UNKNOWN
      ? (best.audit.classification as AirbnbEmailEventKind)
      : AirbnbEmailEventKind.CONFIRMED;

  await persistReservationMatchLinkage({
    auditId: best.audit.id,
    match: baseMatch,
    eventKind: eventKindForPersist,
    signals: best.signals,
    payload:
      (best.audit.parsedPayload ?? {
        source: "manual_resolver",
        reason: best.reason,
      }) as Prisma.InputJsonValue,
    organizationId: reservationRow.property.organizationId,
    propertyId: reservation.propertyId,
  });

  const [linkedAuditCount, reservationEmailEventCount] = await Promise.all([
    db.emailIngestionAudit.count({ where: { reservationId } }),
    db.reservationEmailEvent.count({ where: { reservationId } }),
  ]);

  airbnbEmailLog.info("ui_enrichment_relation_verified", {
    reservationId,
    propertyId: reservation.propertyId,
    linkedAuditCount,
    reservationEmailEventCount,
    source: "manual_resolver",
  });

  return {
    status: "linked",
    linkedAuditId: best.audit.id,
    reservationId,
    linkedAuditCount,
    reservationEmailEventCount,
  };
}

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
        payload: true,
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
      select: { id: true, processedAt: true },
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
      select: { reservationCode: true, propertyId: true, guestName: true },
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
  const latestEventWithGuest = events.find((event) => extractGuestNameFromEvent(event));
  const eventGuestName = latestEventWithGuest
    ? extractGuestNameFromEvent(latestEventWithGuest)
    : null;
  const fallbackGuestName = reservation?.guestName?.trim() || null;
  const airbnbGuestName = eventGuestName ?? fallbackGuestName ?? null;
  const latestAuditId = audits[0]?.id ?? null;
  airbnbEmailLog.info("enrichment_guest_name_persist_check", {
    reservationId,
    auditId: latestAuditId ?? undefined,
    guestName: airbnbGuestName ?? undefined,
    persisted: Boolean(airbnbGuestName),
  });

  return {
    emailEnriched:
      Boolean(enrichedEvent) ||
      events.length > 0 ||
      Boolean(latestEvent?.confirmationCode),
    emailEventCount: events.length,
    linkedAuditCount,
    propertyAuditCount,
    airbnbGuestName,
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
