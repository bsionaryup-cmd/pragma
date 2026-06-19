import "server-only";

import { ReservationActivityType, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildEmailBody } from "@/modules/airbnb-email/parsing/extractors";
import { toPersistedMatchMethod } from "@/modules/airbnb-email/lib/match-method-persistence";
import { matchReservationFromEmailSignals } from "@/modules/airbnb-email/matching/reservation-matcher";
import { resolvePropertyIdFromEmailSignals } from "@/modules/airbnb-email/matching/property-resolver";
import { isLikelyGuestMessageEmail } from "@/modules/reservation-activity/classifiers/activity-email-classifier";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import {
  ensureLinkedGuestMessageActivities,
  repairUnparseableGuestMessageActivities,
} from "@/modules/reservation-activity/services/repair-guest-message-bodies";
import {
  deletePendingActivityBySourceEmailId,
} from "@/modules/reservation-activity/services/persist-reservation-activity-pending";
import { persistReservationActivity } from "@/modules/reservation-activity/services/persist-reservation-activity";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { propertyWhere } from "@/lib/platform/tenant-data-scope";

function reservationScopeWhere(
  scope: TenantDataScope,
): Prisma.ReservationWhereInput {
  return scope.organizationId
    ? { property: { organizationId: scope.organizationId } }
    : { property: propertyWhere(scope) };
}

function readAuditEmailBody(rawEmail: unknown, subject: string): string {
  if (!rawEmail || typeof rawEmail !== "object" || Array.isArray(rawEmail)) {
    return subject;
  }
  const record = rawEmail as Record<string, unknown>;
  return buildEmailBody({
    subject,
    html: typeof record.html === "string" ? record.html : null,
    text: typeof record.text === "string" ? record.text : null,
  });
}

export async function repairMisclassifiedGuestMessageActivities(
  scope: TenantDataScope,
): Promise<number> {
  const candidates = await db.reservationActivity.findMany({
    where: {
      activityType: ReservationActivityType.UNMATCHED_AIRBNB,
      sourceEmailId: { not: null },
      reservation: reservationScopeWhere(scope),
    },
    select: { id: true, sourceEmailId: true },
    take: 80,
    orderBy: { createdAt: "desc" },
  });

  let repaired = 0;
  for (const activity of candidates) {
    if (!activity.sourceEmailId) continue;
    const audit = await db.emailIngestionAudit.findUnique({
      where: { id: activity.sourceEmailId },
      select: { subject: true, rawEmail: true },
    });
    if (!audit) continue;

    const body = readAuditEmailBody(audit.rawEmail, audit.subject);
    if (!isLikelyGuestMessageEmail({ subject: audit.subject, body })) continue;

    await db.reservationActivity.update({
      where: { id: activity.id },
      data: { activityType: ReservationActivityType.AIRBNB_MESSAGE },
    });
    repaired += 1;
  }

  return repaired;
}

export async function promotePendingGuestMessageActivities(
  scope: TenantDataScope,
): Promise<number> {
  const pendingRows = await db.reservationActivityPending.findMany({
    where: {
      activityType: ReservationActivityType.AIRBNB_MESSAGE,
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      sourceEmailId: true,
      propertyId: true,
      activityType: true,
      title: true,
      content: true,
      senderName: true,
      senderEmail: true,
      metadataJson: true,
      createdAt: true,
    },
  });

  if (pendingRows.length === 0) return 0;

  const audits = await db.emailIngestionAudit.findMany({
    where: {
      id: { in: pendingRows.map((row) => row.sourceEmailId) },
      reservationId: { not: null },
    },
    select: { id: true, reservationId: true },
  });
  const reservationByAuditId = new Map(
    audits.map((row) => [row.id, row.reservationId!]),
  );

  let promoted = 0;
  for (const pending of pendingRows) {
    const reservationId = reservationByAuditId.get(pending.sourceEmailId);
    if (!reservationId) continue;

    const existingActivity = await db.reservationActivity.findUnique({
      where: { sourceEmailId: pending.sourceEmailId },
      select: { id: true },
    });
    if (existingActivity) {
      await deletePendingActivityBySourceEmailId(pending.sourceEmailId);
      continue;
    }

    await persistReservationActivity({
      reservationId,
      propertyId: pending.propertyId,
      activityType: pending.activityType,
      title: pending.title,
      content: pending.content,
      sourceEmailId: pending.sourceEmailId,
      senderName: pending.senderName,
      senderEmail: pending.senderEmail,
      metadata: pending.metadataJson as Record<string, unknown> | null,
      createdAt: pending.createdAt,
    });
    await deletePendingActivityBySourceEmailId(pending.sourceEmailId);
    promoted += 1;
  }

  return promoted;
}

function readSignalsFromAuditPayload(
  payload: unknown,
): ExtractedReservationSignals | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const signals = (payload as { signals?: unknown }).signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  return signals as ExtractedReservationSignals;
}

export async function relinkUnlinkedGuestMessageAudits(
  scope: TenantDataScope,
): Promise<number> {
  if (!scope.organizationId) return 0;

  const pendingRows = await db.reservationActivityPending.findMany({
    where: {
      organizationId: scope.organizationId,
      activityType: ReservationActivityType.AIRBNB_MESSAGE,
    },
    select: { sourceEmailId: true },
    take: 80,
  });
  const pendingAuditIds = pendingRows.map((row) => row.sourceEmailId);

  const audits = await db.emailIngestionAudit.findMany({
    where: {
      organizationId: scope.organizationId,
      reservationId: null,
      OR: [
        ...(pendingAuditIds.length > 0
          ? [{ id: { in: pendingAuditIds } }]
          : []),
        { subject: { contains: "Consulta sobre", mode: "insensitive" as const } },
        { subject: { contains: "Preaprobación", mode: "insensitive" as const } },
        { subject: { contains: "Reserva de", mode: "insensitive" as const } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      subject: true,
      parsedPayload: true,
      propertyId: true,
      rawEmail: true,
    },
  });

  let linked = 0;
  for (const audit of audits) {
    const signals = readSignalsFromAuditPayload(audit.parsedPayload);
    if (!signals) continue;

    const body = readAuditEmailBody(audit.rawEmail, audit.subject);
    if (!isLikelyGuestMessageEmail({ subject: audit.subject, body }) &&
        !audit.subject.toLowerCase().includes("consulta sobre") &&
        !audit.subject.toLowerCase().includes("preaprobación")) {
      continue;
    }

    const propertyResolution = await resolvePropertyIdFromEmailSignals(
      scope.organizationId,
      signals,
      audit.propertyId,
    );
    const match = await matchReservationFromEmailSignals(signals, {
      organizationId: scope.organizationId,
      propertyId: propertyResolution.propertyId ?? audit.propertyId,
      listingAmbiguous: propertyResolution.ambiguous,
    });
    if (!match.reservationId) continue;

    await db.emailIngestionAudit.update({
      where: { id: audit.id },
      data: {
        reservationId: match.reservationId,
        propertyId: match.propertyId ?? propertyResolution.propertyId ?? audit.propertyId,
        matchMethod: toPersistedMatchMethod(match.method),
        matchConfidence: match.confidence,
      },
    });
    linked += 1;
  }

  return linked;
}

export async function syncGuestMessageActivitiesForFeed(
  scope: TenantDataScope,
): Promise<void> {
  await repairMisclassifiedGuestMessageActivities(scope);
  await relinkUnlinkedGuestMessageAudits(scope);
  await promotePendingGuestMessageActivities(scope);
  await ensureLinkedGuestMessageActivities(scope);
  await repairUnparseableGuestMessageActivities(scope);
}
