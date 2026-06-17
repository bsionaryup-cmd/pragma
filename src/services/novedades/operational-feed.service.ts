import "server-only";

import {
  AirbnbEmailEventKind,
  ReservationActivityType,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import {
  mergeReservationScope,
  propertyWhere,
} from "@/lib/platform/tenant-data-scope";
import { groupOperationalFeedByReservation } from "@/services/novedades/operational-feed.group";
import {
  mapEmailEvent,
  mapGuestMessageActivity,
  mapGuestPaymentLink,
  mapGuestRegistrationAlert,
  mapModificationEvent,
  mapPayout,
  mapReservationCommunication,
  mapReservationPayment,
  reservationSelect,
} from "@/services/novedades/operational-feed.mappers";
import { sanitizeOperationalFeedCards } from "@/services/novedades/operational-feed.policy";
import type {
  OperationalFeedCard,
  OperationalFeedView,
} from "@/services/novedades/operational-feed.types";

const FEED_EMAIL_EVENT_KINDS: AirbnbEmailEventKind[] = [
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.CANCELED,
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
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

async function collectOperationalFeedCards(
  scope: TenantDataScope,
  take: number,
): Promise<OperationalFeedCard[]> {
  const [
    modificationEvents,
    guestActivities,
    payouts,
    emailEvents,
    reservationPayments,
    guestPaymentLinks,
    communications,
    guestRegistrationAlerts,
  ] = await Promise.all([
    db.reservationEvent.findMany({
      where: reservationEventWhere(scope),
      orderBy: { createdAt: "desc" },
      take,
      include: {
        property: { select: { name: true, unitNumber: true, city: true } },
        reservation: { select: reservationSelect },
      },
    }),
    db.reservationActivity.findMany({
      where: guestMessageActivityWhere(scope),
      orderBy: { createdAt: "desc" },
      take,
      include: {
        property: { select: { name: true, unitNumber: true, city: true } },
        reservation: { select: reservationSelect },
      },
    }),
    db.reservationPayout.findMany({
      where: { audit: auditWhere(scope) },
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
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
        audit: { select: { createdAt: true, subject: true } },
      },
    }),
    db.reservationPayment.findMany({
      where: reservationPaymentWhere(scope),
      orderBy: { createdAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
      },
    }),
    db.guestPaymentLink.findMany({
      where: guestPaymentLinkWhere(scope),
      orderBy: { updatedAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
      },
    }),
    db.reservationCommunication.findMany({
      where: reservationCommunicationWhere(scope),
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 40),
      include: {
        reservation: { select: reservationSelect },
      },
    }),
    listGuestRegistrationAlerts(scope),
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
  ];
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
    unlinked: view.unlinked.slice(0, 10),
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
