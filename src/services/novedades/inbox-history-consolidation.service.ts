import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { prismaDateToKey } from "@/lib/dates";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { mergeReservationScope, propertyWhere } from "@/lib/platform/tenant-data-scope";
import type { NovedadesUnlinkedInquiryItem } from "@/services/novedades/novedades-inbox.types";
import {
  type InboxHistoryAbsorptionMatch,
  type InboxHistoryConsolidationPlan,
  type InboxHistoryInquiryCandidate,
  planInboxHistoryConsolidation,
} from "@/services/novedades/inbox-history-consolidation";
import { parseInquiryPropertyFromSubject } from "@/services/novedades/novedades-unlinked-inquiry.logic";

export type InboxHistoryConsolidationContext = {
  plan: InboxHistoryConsolidationPlan;
  absorbedInquiryIds: Set<string>;
  matchesByReservationId: Map<string, InboxHistoryAbsorptionMatch[]>;
  inquiryByPendingId: Map<string, NovedadesUnlinkedInquiryItem>;
  reservationIdByInquiryId: Map<string, string>;
};

function pendingWhere(scope: TenantDataScope): Prisma.ReservationActivityPendingWhereInput {
  if (scope.organizationId) {
    return { organizationId: scope.organizationId };
  }
  return { property: propertyWhere(scope) };
}

export async function buildInboxHistoryConsolidationContext(
  scope: TenantDataScope,
  inquiries: NovedadesUnlinkedInquiryItem[],
): Promise<InboxHistoryConsolidationContext> {
  const inquiryByPendingId = new Map(inquiries.map((row) => [row.pendingActivityId, row]));

  if (inquiries.length === 0) {
    return {
      plan: {
        matches: [],
        unmatchedInquiryIds: [],
        stats: {
          inquiryCount: 0,
          reservationCount: 0,
          absorbedCount: 0,
          consultaAirbnbBefore: 0,
          consultaAirbnbAfterUnmatched: 0,
        },
      },
      absorbedInquiryIds: new Set(),
      matchesByReservationId: new Map(),
      inquiryByPendingId,
      reservationIdByInquiryId: new Map(),
    };
  }

  const properties = await db.property.findMany({
    where: scope.organizationId
      ? { organizationId: scope.organizationId }
      : propertyWhere(scope),
    select: {
      id: true,
      name: true,
      unitNumber: true,
    },
  });

  const reservations = await db.reservation.findMany({
    where: mergeReservationScope(scope, {}),
    select: {
      id: true,
      propertyId: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const pendingMeta = await db.reservationActivityPending.findMany({
    where: { id: { in: inquiries.map((row) => row.pendingActivityId) } },
    select: { id: true, propertyId: true, content: true, createdAt: true },
  });
  const pendingMetaById = new Map(pendingMeta.map((row) => [row.id, row]));

  const inquiryCandidates: InboxHistoryInquiryCandidate[] = inquiries.map((inquiry) => {
    const meta = pendingMetaById.get(inquiry.pendingActivityId);
    return {
      pendingActivityId: inquiry.pendingActivityId,
      propertyId: meta?.propertyId ?? null,
      propertyHint: parseInquiryPropertyFromSubject(inquiry.subject),
      createdAt: inquiry.latestAt,
      guestName: inquiry.guestName,
      dateRangeLabel: inquiry.dateRangeLabel,
      subject: inquiry.subject,
      narrative: inquiry.latestNarrative,
      content: meta?.content ?? inquiry.latestNarrative,
    };
  });

  const plan = planInboxHistoryConsolidation({
    inquiries: inquiryCandidates,
    reservations: reservations.map((row) => ({
      reservationId: row.id,
      propertyId: row.propertyId,
      guestName: row.guestName,
      checkIn: prismaDateToKey(row.checkIn),
      checkOut: prismaDateToKey(row.checkOut),
      createdAt: row.createdAt.toISOString(),
    })),
    properties: properties.map((row) => ({
      propertyId: row.id,
      name: row.name,
      unitNumber: row.unitNumber,
    })),
  });

  const absorbedInquiryIds = new Set(plan.matches.map((row) => row.pendingActivityId));
  const matchesByReservationId = new Map<string, InboxHistoryAbsorptionMatch[]>();
  const reservationIdByInquiryId = new Map<string, string>();

  for (const match of plan.matches) {
    reservationIdByInquiryId.set(match.pendingActivityId, match.reservationId);
    const list = matchesByReservationId.get(match.reservationId) ?? [];
    list.push(match);
    matchesByReservationId.set(match.reservationId, list);
  }

  return {
    plan,
    absorbedInquiryIds,
    matchesByReservationId,
    inquiryByPendingId,
    reservationIdByInquiryId,
  };
}
