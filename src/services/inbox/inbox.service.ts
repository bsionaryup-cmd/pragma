import "server-only";

import { db } from "@/lib/db";
import { propertyWhere } from "@/lib/platform/tenant-data-scope";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { mergeReservationScope } from "@/lib/platform/tenant-data-scope";
import {
  listReservationsForInbox,
  getReservationForInbox,
} from "@/services/reservations/reservation.service";
import {
  mapReservationToConversation,
  mapReservationToConversationSummary,
} from "@/features/inbox/lib/map-reservation-to-conversation";
import { isInboxConversationUnread } from "@/features/inbox/lib/inbox-unread";
import type { InboxConversation } from "@/types/inbox";

async function loadPropertyCoverImages(
  propertyIds: string[],
): Promise<Map<string, string | null>> {
  if (propertyIds.length === 0) return new Map();

  const scope = await requireTenantDataScope();
  const rows = await db.property.findMany({
    where: {
      ...propertyWhere(scope),
      id: { in: propertyIds },
    },
    select: { id: true, coverImageUrl: true },
  });

  return new Map(rows.map((row) => [row.id, row.coverImageUrl]));
}

async function loadReservationExtras(reservationIds: string[]) {
  if (reservationIds.length === 0) return new Map();

  const scope = await requireTenantDataScope();
  const rows = await db.reservation.findMany({
    where: mergeReservationScope(scope, { id: { in: reservationIds } }),
    select: {
      id: true,
      paymentStatus: true,
      reservationCode: true,
      icalUid: true,
      updatedAt: true,
    },
  });

  return new Map(rows.map((row) => [row.id, row]));
}

export type InboxConversationsResult = {
  conversations: InboxConversation[];
  unreadCount: number;
};

export async function listInboxConversations(): Promise<InboxConversationsResult> {
  const reservations = await listReservationsForInbox();
  const propertyIds = [...new Set(reservations.map((r) => r.property.id))];
  const reservationIds = reservations.map((r) => r.id);

  const [coverByProperty, extrasByReservation] = await Promise.all([
    loadPropertyCoverImages(propertyIds),
    loadReservationExtras(reservationIds),
  ]);

  const conversations = reservations.map((reservation) =>
    mapReservationToConversationSummary(
      reservation,
      coverByProperty.get(reservation.property.id) ?? null,
      extrasByReservation.get(reservation.id),
    ),
  );

  const unreadCount = reservations.filter(isInboxConversationUnread).length;

  return { conversations, unreadCount };
}

export async function getInboxConversationById(
  id: string,
): Promise<InboxConversation | null> {
  const reservation = await getReservationForInbox(id);
  if (!reservation) return null;

  const scope = await requireTenantDataScope();
  const [property, extras] = await Promise.all([
    db.property.findFirst({
      where: {
        ...propertyWhere(scope),
        id: reservation.property.id,
      },
      select: { coverImageUrl: true },
    }),
    db.reservation.findFirst({
      where: mergeReservationScope(scope, { id }),
      select: {
        paymentStatus: true,
        reservationCode: true,
        icalUid: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!extras) return null;

  return mapReservationToConversation(
    reservation,
    property?.coverImageUrl ?? null,
    extras,
  );
}
