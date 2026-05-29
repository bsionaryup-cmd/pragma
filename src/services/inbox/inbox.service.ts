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

export type InboxConversationsResult = {
  conversations: InboxConversation[];
  unreadCount: number;
};

export async function listInboxConversations(): Promise<InboxConversationsResult> {
  const reservations = await listReservationsForInbox();

  const conversations = reservations.map((reservation) =>
    mapReservationToConversationSummary(reservation, null),
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
    property?.coverImageUrl ?? reservation.property.coverImageUrl ?? null,
    extras,
  );
}
