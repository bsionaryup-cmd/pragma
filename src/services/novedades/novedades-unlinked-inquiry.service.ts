import "server-only";

import {
  ReservationActivityType,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { propertyWhere } from "@/lib/platform/tenant-data-scope";
import { guestInitialsFromName } from "@/services/novedades/operational-feed.copy";
import { formatOperationalRelativeTime } from "@/services/novedades/operational-feed.present";
import type { NovedadesUnlinkedInquiryItem } from "@/services/novedades/novedades-inbox.types";
import {
  formatInquiryPropertyLabel,
  parseInquiryDateRangeFromSubject,
  resolveInquiryGuestName,
  resolveInquiryNarrative,
  shouldIncludePendingInquiry,
} from "@/services/novedades/novedades-unlinked-inquiry.logic";
import { detectInboxMessageIntent, inboxIntentLabel } from "@/services/inbox-ai/inbox-intent.service";
import {
  extractGuestNameFromAuditPayload,
  extractGuestNameFromReservationEmailEvent,
} from "@/services/reservations/airbnb-display-guest-name.service";

function resolveInquiryGuestNameFromSources(input: {
  senderName: string | null | undefined;
  subject: string | null | undefined;
  narrative: string | null | undefined;
  content: string;
  audit: {
    parsedPayload: unknown;
  } | null | undefined;
  emailEvent: {
    enrichedFields: unknown;
    payload: unknown;
  } | null | undefined;
}): string {
  const auditGuestName = input.audit
    ? extractGuestNameFromAuditPayload(input.audit.parsedPayload)
    : null;

  const enrichedGuestName =
    (input.emailEvent
      ? extractGuestNameFromReservationEmailEvent({
          enrichedFields: input.emailEvent.enrichedFields,
          payload: input.emailEvent.payload,
        })
      : null) ?? auditGuestName;

  return resolveInquiryGuestName({
    senderName: input.senderName,
    subject: input.subject,
    narrative: input.narrative,
    auditGuestName,
    enrichedGuestName,
    content: input.content,
  });
}

function pendingWhere(scope: TenantDataScope): Prisma.ReservationActivityPendingWhereInput {
  if (scope.organizationId) {
    return { organizationId: scope.organizationId };
  }

  return {
    property: propertyWhere(scope),
  };
}

export async function listNovedadesUnlinkedInquiryItems(
  scope: TenantDataScope,
  limit = 40,
): Promise<NovedadesUnlinkedInquiryItem[]> {
  const pendingRows = await db.reservationActivityPending.findMany({
    where: {
      ...pendingWhere(scope),
      activityType: ReservationActivityType.AIRBNB_MESSAGE,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit * 3, 60), 200),
    select: {
      id: true,
      activityType: true,
      title: true,
      content: true,
      rawSubject: true,
      senderName: true,
      createdAt: true,
      propertyId: true,
      sourceEmailId: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
        },
      },
    },
  });

  if (pendingRows.length === 0) return [];

  const auditIds = pendingRows.map((row) => row.sourceEmailId);
  const audits = await db.emailIngestionAudit.findMany({
    where: {
      id: { in: auditIds },
      reservationId: null,
    },
      select: {
        id: true,
        subject: true,
        parsedPayload: true,
      },
  });
  const auditById = new Map(audits.map((row) => [row.id, row]));

  const emailEvents = await db.reservationEmailEvent.findMany({
    where: { auditId: { in: auditIds } },
    select: {
      auditId: true,
      enrichedFields: true,
      payload: true,
    },
  });
  const emailEventByAuditId = new Map(emailEvents.map((row) => [row.auditId, row]));

  const items: NovedadesUnlinkedInquiryItem[] = [];

  for (const row of pendingRows) {
    const audit = auditById.get(row.sourceEmailId);
    if (!audit) continue;

    const subject = row.rawSubject ?? audit.subject;
    const auditGuestName = extractGuestNameFromAuditPayload(audit.parsedPayload);

    if (
      !shouldIncludePendingInquiry({
        activityType: row.activityType,
        subject,
        content: row.content,
        senderName: row.senderName,
        auditGuestName,
      })
    ) {
      continue;
    }

    const narrative =
      resolveInquiryNarrative({
        content: row.content,
        subject,
        senderName: row.senderName,
        auditGuestName,
      }) ?? "Mensaje del huésped";

    const guestName = resolveInquiryGuestNameFromSources({
      senderName: row.senderName,
      subject,
      narrative,
      content: row.content,
      audit,
      emailEvent: emailEventByAuditId.get(row.sourceEmailId) ?? null,
    });

    const latestAt = row.createdAt.toISOString();
    const latestIntentLabel = inboxIntentLabel(
      detectInboxMessageIntent(narrative).intent,
    );

    items.push({
      pendingActivityId: row.id,
      guestName,
      guestInitials: guestInitialsFromName(guestName),
      propertyLabel: formatInquiryPropertyLabel({
        propertyName: row.property?.name,
        unitNumber: row.property?.unitNumber,
        subject,
      }),
      dateRangeLabel: parseInquiryDateRangeFromSubject(subject),
      latestAt,
      latestTimeLabel: formatOperationalRelativeTime(latestAt),
      latestNarrative: narrative,
      latestIntentLabel,
      subject,
    });

    if (items.length >= limit) break;
  }

  return items;
}

export async function getNovedadesUnlinkedInquiryDetail(
  scope: TenantDataScope,
  pendingActivityId: string,
): Promise<NovedadesUnlinkedInquiryItem | null> {
  const row = await db.reservationActivityPending.findFirst({
    where: {
      id: pendingActivityId,
      ...pendingWhere(scope),
      activityType: ReservationActivityType.AIRBNB_MESSAGE,
    },
    select: {
      id: true,
      activityType: true,
      content: true,
      rawSubject: true,
      senderName: true,
      createdAt: true,
      sourceEmailId: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
        },
      },
    },
  });

  if (!row) return null;

  const audit = await db.emailIngestionAudit.findFirst({
    where: {
      id: row.sourceEmailId,
      reservationId: null,
    },
    select: {
      subject: true,
      parsedPayload: true,
    },
  });

  if (!audit) return null;

  const emailEvent = await db.reservationEmailEvent.findFirst({
    where: { auditId: row.sourceEmailId },
    select: {
      enrichedFields: true,
      payload: true,
    },
  });

  const subject = row.rawSubject ?? audit.subject;
  const auditGuestName = extractGuestNameFromAuditPayload(audit.parsedPayload);

  if (
    !shouldIncludePendingInquiry({
      activityType: row.activityType,
      subject,
      content: row.content,
      senderName: row.senderName,
      auditGuestName,
    })
  ) {
    return null;
  }

  const narrative =
    resolveInquiryNarrative({
      content: row.content,
      subject,
      senderName: row.senderName,
      auditGuestName,
    }) ?? "Mensaje del huésped";

  const guestName = resolveInquiryGuestNameFromSources({
    senderName: row.senderName,
    subject,
    narrative,
    content: row.content,
    audit,
    emailEvent,
  });

  const latestAt = row.createdAt.toISOString();

  return {
    pendingActivityId: row.id,
    guestName,
    guestInitials: guestInitialsFromName(guestName),
    propertyLabel: formatInquiryPropertyLabel({
      propertyName: row.property?.name,
      unitNumber: row.property?.unitNumber,
      subject,
    }),
    dateRangeLabel: parseInquiryDateRangeFromSubject(subject),
    latestAt,
    latestTimeLabel: formatOperationalRelativeTime(latestAt),
    latestNarrative: narrative,
    latestIntentLabel: inboxIntentLabel(detectInboxMessageIntent(narrative).intent),
    subject,
  };
}
