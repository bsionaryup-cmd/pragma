import "server-only";

import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { mergeReservationScope } from "@/lib/platform/tenant-data-scope";
import {
  buildFeedNarrative,
  guestInitialsFromName,
  resolveNovedadesGuestName,
} from "@/services/novedades/operational-feed.copy";
import { resolveGuestMessageBodiesForDisplay, resolveGuestMessageParseName } from "@/services/novedades/operational-feed.message";
import { formatOperationalRelativeTime, formatPayoutAmount } from "@/services/novedades/operational-feed.present";
import type { OperationalFeedKind } from "@/services/novedades/operational-feed.types";
import { groupOperationalFeedByReservation } from "@/services/novedades/operational-feed.group";
import { listOperationalFeedCardsForTenant } from "@/services/novedades/operational-feed.service";
import type {
  NovedadesInboxListItem,
  NovedadesInboxSnapshot,
  NovedadesTimelineKind,
} from "@/services/novedades/novedades-inbox.types";
import { buildNovedadesReservationDetail } from "@/services/novedades/novedades-timeline.service";
import { getAirbnbEnrichedGuestNameByReservationIds } from "@/services/reservations/airbnb-display-guest-name.service";

function feedKindToTimelineKind(kind: OperationalFeedKind): NovedadesTimelineKind {
  return kind;
}

function previewNarrative(
  event: Parameters<typeof buildFeedNarrative>[0],
  guestName: string,
): string {
  if (event.kind === "GUEST_MESSAGE") {
    const parseGuestName = resolveGuestMessageParseName({
      raw: event.summary,
      guestName: event.guestName ?? guestName,
    });
    const bodies = resolveGuestMessageBodiesForDisplay(event.summary, {
      guestName: parseGuestName,
    });
    if (bodies.length > 0) return bodies[bodies.length - 1]!;
    return "Mensaje del huésped";
  }
  return buildFeedNarrative({
    ...event,
    guestName: guestName.startsWith("Reserva ") ? event.guestName : guestName,
  });
}

function pickLatestDisplayEvent(
  events: Parameters<typeof previewNarrative>[0][],
  guestName: string,
) {
  for (const event of events) {
    if (event.kind === "GUEST_MESSAGE") {
      const parseGuestName = resolveGuestMessageParseName({
        raw: event.summary,
        guestName: event.guestName ?? guestName,
      });
      const bodies = resolveGuestMessageBodiesForDisplay(event.summary, {
        guestName: parseGuestName,
      });
      if (bodies.length === 0) continue;
      return { event, narrative: bodies[bodies.length - 1]! };
    }
    return { event, narrative: previewNarrative(event, guestName) };
  }
  return null;
}

export async function listNovedadesInboxItems(
  scope: TenantDataScope,
  limit = 80,
): Promise<NovedadesInboxListItem[]> {
  const cards = await listOperationalFeedCardsForTenant(scope, Math.max(limit * 2, 160));
  const grouped = groupOperationalFeedByReservation(cards).groups
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
    .slice(0, limit);

  if (grouped.length === 0) return [];

  const reservationIds = grouped.map((group) => group.reservationId);
  const [reservations, enrichedNames] = await Promise.all([
    db.reservation.findMany({
      where: mergeReservationScope(scope, { id: { in: reservationIds } }),
      select: {
        id: true,
        platform: true,
        guestName: true,
        reservationCode: true,
        totalAmount: true,
        currency: true,
      },
    }),
    getAirbnbEnrichedGuestNameByReservationIds(reservationIds),
  ]);
  const reservationById = new Map(reservations.map((row) => [row.id, row]));

  return grouped.map((group) => {
    const reservation = reservationById.get(group.reservationId);
    const guestName = resolveNovedadesGuestName({
      guestName: reservation?.guestName ?? group.guestName,
      confirmationCode: group.confirmationCode ?? reservation?.reservationCode,
      enrichedGuestName: enrichedNames.get(group.reservationId),
      platform: reservation?.platform ?? null,
    });
    const latestDisplay = pickLatestDisplayEvent(group.events, guestName);
    const latestEvent = latestDisplay?.event ?? group.events[0];
    const latestNarrative =
      latestDisplay?.narrative ??
      (latestEvent ? previewNarrative(latestEvent, guestName) : "Sin actividad reciente");

    const reservationAmount = reservation
      ? formatPayoutAmount(Number(reservation.totalAmount), reservation.currency)
      : null;

    return {
      reservationId: group.reservationId,
      guestName,
      guestInitials: guestInitialsFromName(guestName),
      propertyLabel: group.propertyLabel ?? "Sin propiedad",
      dateRangeLabel: group.dateRangeLabel,
      confirmationCode: group.confirmationCode,
      reservationStatus: group.reservationStatus,
      statusLabel: group.statusLabel,
      platform: reservation?.platform ?? null,
      latestAt: group.latestAt,
      latestTimeLabel: formatOperationalRelativeTime(group.latestAt),
      latestNarrative,
      latestKind: latestEvent ? feedKindToTimelineKind(latestEvent.kind) : null,
      amountLabel: latestEvent?.amountLabel ?? reservationAmount,
      attentionCount: group.attentionCount,
      eventCount: group.events.length,
    };
  });
}

export async function getNovedadesInboxSnapshot(
  scope: TenantDataScope,
  limit = 80,
): Promise<NovedadesInboxSnapshot> {
  const items = await listNovedadesInboxItems(scope, limit);
  return {
    items,
    latestAt: items[0]?.latestAt ?? null,
  };
}

export { buildNovedadesReservationDetail };
