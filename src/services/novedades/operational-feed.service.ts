import "server-only";

import {
  AirbnbEmailEventKind,
  ReservationActivityType,
  ReservationStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { promotePendingActivitiesForReservation } from "@/modules/reservation-activity/services/promote-pending-activities";
import { syncGuestMessageActivitiesForFeed } from "@/modules/reservation-activity/services/sync-guest-message-activities";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import {
  mergeReservationScope,
  propertyWhere,
} from "@/lib/platform/tenant-data-scope";
import { groupOperationalFeedByReservation } from "@/services/novedades/operational-feed.group";
import {
  mapEmailEvent,
  mapCanceledReservationFallback,
  mapGuestMessageActivity,
  mapGuestPaymentLink,
  mapGuestRegistrationAlert,
  mapModificationEvent,
  mapPayout,
  mapReservationCommunication,
  mapReservationPayment,
  reservationSelect,
} from "@/services/novedades/operational-feed.mappers";
import { sanitizeOperationalFeedCards, filterUnlinkedFeedCards } from "@/services/novedades/operational-feed.policy";
import type {
  OperationalFeedCard,
  OperationalFeedView,
} from "@/services/novedades/operational-feed.types";

const FEED_EMAIL_EVENT_KINDS: AirbnbEmailEventKind[] = [
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.CANCELED,
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
  AirbnbEmailEventKind.PAYOUT_PROCESSED,
  AirbnbEmailEventKind.EARLY_CHECKIN_REQUEST,
  AirbnbEmailEventKind.TRANSPORT_REQUEST,
];

function auditWhere(scope: TenantDataScope): Prisma.EmailIngestionAuditWhereInput {
  return scope.organizationId != null
    ? { organizationId: scope.organizationId }
    : { property: propertyWhere(scope) };
}

function reservationEventWhere(
  scope: TenantDataScope,
): Prisma.ReservationEventWhereInput {
  return scope.organizationId != null
    ? { organizationId: scope.organizationId }
    : { property: propertyWhere(scope) };
}

function guestMessageActivityWhere(
  scope: TenantDataScope,
): Prisma.ReservationActivityWhereInput {
  const reservationScope: Prisma.ReservationWhereInput = scope.organizationId
    ? { property: { organizationId: scope.organizationId } }
    : { property: propertyWhere(scope) };

  return {
    activityType: ReservationActivityType.AIRBNB_MESSAGE,
    reservation: reservationScope,
  };
}

function reservationPaymentWhere(
  scope: TenantDataScope,
): Prisma.ReservationPaymentWhereInput {
  return {
    reservation: scope.organizationId
      ? { property: { organizationId: scope.organizationId } }
      : { property: propertyWhere(scope) },
  };
}

function guestPaymentLinkWhere(
  scope: TenantDataScope,
): Prisma.GuestPaymentLinkWhereInput {
  const base: Prisma.GuestPaymentLinkWhereInput = {
    status: "PAID",
    reservationId: { not: null },
  };

  if (scope.organizationId != null) {
    return { ...base, organizationId: scope.organizationId };
  }

  return {
    ...base,
    reservation: { property: propertyWhere(scope) },
  };
}

function reservationCommunicationWhere(
  scope: TenantDataScope,
): Prisma.ReservationCommunicationWhereInput {
  const reservationScope = scope.organizationId
    ? { property: { organizationId: scope.organizationId } }
    : { property: propertyWhere(scope) };

  return {
    reservation: reservationScope,
    OR: [
      { requiresAction: true },
      { parsedIntent: { in: ["EARLY_CHECKIN", "TRANSPORT"] } },
    ],
  };
}

async function listGuestRegistrationAlerts(
  scope: TenantDataScope,
): Promise<OperationalFeedCard[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db.reservation.findMany({
    where: mergeReservationScope(scope, {
      guestRegistrationCompletedAt: { gte: sevenDaysAgo },
      guestRegistrationAdminNotifiedAt: null,
      guestRegistrationAdminNotificationError: { not: null },
    }),
    orderBy: { guestRegistrationCompletedAt: "desc" },
    take: 20,
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      guestRegistrationCompletedAt: true,
      guestRegistrationAdminNotificationError: true,
      property: {
        select: {
          id: true,
          name: true,
          unitNumber: true,
          city: true,
        },
      },
    },
  });

  return rows
    .map(mapGuestRegistrationAlert)
    .filter((row): row is OperationalFeedCard => row != null);
}

async function listCanceledReservationFallbackCards(
  scope: TenantDataScope,
  reservationId?: string,
): Promise<OperationalFeedCard[]> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const rows = await db.reservation.findMany({
    where: mergeReservationScope(scope, {
      status: ReservationStatus.CANCELLED,
      updatedAt: { gte: cutoff },
      ...(reservationId ? { id: reservationId } : {}),
    }),
    orderBy: { updatedAt: "desc" },
    take: reservationId ? 1 : 40,
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      reservationCode: true,
      updatedAt: true,
      property: {
        select: {
          id: true,
          name: true,
          unitNumber: true,
          city: true,
        },
      },
    },
  });

  if (rows.length === 0) return [];

  const emailCancelReservationIds = new Set(
    (
      await db.reservationEmailEvent.findMany({
        where: {
          eventKind: AirbnbEmailEventKind.CANCELED,
          reservationId: { in: rows.map((row) => row.id) },
        },
        select: { reservationId: true },
      })
    )
      .map((row) => row.reservationId)
      .filter((id): id is string => Boolean(id)),
  );

  return rows
    .filter((row) => !emailCancelReservationIds.has(row.id))
    .map(mapCanceledReservationFallback);
}

async function collectOperationalFeedCards(
  scope: TenantDataScope,
  take: number,
  reservationId?: string,
): Promise<OperationalFeedCard[]> {
  await syncGuestMessageActivitiesForFeed(scope);

  const eventReservationFilter = reservationId ? { reservationId } : {};
  const payoutReservationFilter = reservationId ? { reservationId } : {};
  const emailReservationFilter = reservationId ? { reservationId } : {};

  const [
    modificationEvents,
    guestActivities,
    payouts,
    emailEvents,
    reservationPayments,
    guestPaymentLinks,
    communications,
    guestRegistrationAlerts,
    canceledReservationFallbacks,
  ] = await Promise.all([
    db.reservationEvent.findMany({
      where: { ...reservationEventWhere(scope), ...eventReservationFilter },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        property: { select: { name: true, unitNumber: true, city: true } },
        reservation: { select: reservationSelect },
      },
    }),
    db.reservationActivity.findMany({
      where: {
        ...guestMessageActivityWhere(scope),
        reservationId: reservationId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        property: { select: { name: true, unitNumber: true, city: true } },
        reservation: { select: reservationSelect },
      },
    }),
    db.reservationPayout.findMany({
      where: {
        ...payoutReservationFilter,
        audit: auditWhere(scope),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
        audit: { select: { createdAt: true } },
      },
    }),
    db.reservationEmailEvent.findMany({
      where: {
        eventKind: { in: FEED_EMAIL_EVENT_KINDS },
        audit: auditWhere(scope),
        ...emailReservationFilter,
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
        audit: { select: { createdAt: true, subject: true } },
      },
    }),
    db.reservationPayment.findMany({
      where: reservationId
        ? { reservation: mergeReservationScope(scope, { id: reservationId }) }
        : reservationPaymentWhere(scope),
      orderBy: { createdAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
      },
    }),
    db.guestPaymentLink.findMany({
      where: reservationId
        ? {
            ...guestPaymentLinkWhere(scope),
            reservationId,
          }
        : guestPaymentLinkWhere(scope),
      orderBy: { updatedAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
      },
    }),
    db.reservationCommunication.findMany({
      where: {
        ...reservationCommunicationWhere(scope),
        ...(reservationId ? { reservationId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 40),
      include: {
        reservation: { select: reservationSelect },
      },
    }),
    reservationId
      ? listGuestRegistrationAlerts(scope).then((rows) =>
          rows.filter((row) => row.reservationId === reservationId),
        )
      : listGuestRegistrationAlerts(scope),
    listCanceledReservationFallbackCards(scope, reservationId),
  ]);

  return [
    ...modificationEvents.map(mapModificationEvent),
    ...guestActivities.map(mapGuestMessageActivity),
    ...payouts.map(mapPayout),
    ...emailEvents.map(mapEmailEvent).filter((row): row is OperationalFeedCard => row != null),
    ...reservationPayments.map(mapReservationPayment),
    ...guestPaymentLinks
      .map(mapGuestPaymentLink)
      .filter((row): row is OperationalFeedCard => row != null),
    ...communications
      .map(mapReservationCommunication)
      .filter((row): row is OperationalFeedCard => row != null),
    ...guestRegistrationAlerts,
    ...canceledReservationFallbacks,
  ];
}

export async function listOperationalFeedCardsForReservation(
  scope: TenantDataScope,
  reservationId: string,
): Promise<OperationalFeedCard[]> {
  await promotePendingActivitiesForReservation(reservationId);
  const raw = await collectOperationalFeedCards(scope, 200, reservationId);
  return sanitizeOperationalFeedCards(raw).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export async function listOperationalFeedCardsForTenant(
  scope: TenantDataScope,
  limit = 120,
): Promise<OperationalFeedCard[]> {
  const take = Math.min(Math.max(limit, 1), 200);
  const raw = await collectOperationalFeedCards(scope, take);
  return sanitizeOperationalFeedCards(raw)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, take);
}

export async function listNovedadesFeedForTenant(
  scope: TenantDataScope,
  limit = 60,
): Promise<OperationalFeedView> {
  const cards = await listOperationalFeedCardsForTenant(scope, Math.max(limit * 2, 120));
  const view = groupOperationalFeedByReservation(cards);
  return {
    groups: view.groups.slice(0, limit),
    unlinked: filterUnlinkedFeedCards(view.unlinked).slice(0, 5),
  };
}

/** @deprecated Usar listNovedadesFeedForTenant */
export async function listOperationalFeedForTenant(
  scope: TenantDataScope,
  limit = 60,
): Promise<OperationalFeedCard[]> {
  return listOperationalFeedCardsForTenant(scope, limit);
}

export async function getLatestOperationalFeedTimestamp(
  scope: TenantDataScope,
): Promise<{ latestAt: string | null; latestId: string | null }> {
  const cards = await listOperationalFeedCardsForTenant(scope, 40);
  const latest = cards[0];
  if (!latest) {
    return { latestAt: null, latestId: null };
  }
  return {
    latestAt: latest.createdAt,
    latestId: latest.id,
  };
}
