import type {
  OperationalFeedCard,
  OperationalFeedReservationGroup,
  OperationalFeedView,
} from "@/services/novedades/operational-feed.types";
import {
  guestInitialsFromName,
  resolveNovedadesGuestName,
  RESERVATION_STATUS_LABELS,
} from "@/services/novedades/operational-feed.copy";
import { isPlaceholderGuestName } from "@/services/novedades/operational-feed.message";
import type { ReservationStatus } from "@prisma/client";

function pickGroupGuestName(events: OperationalFeedCard[]): string | null {
  for (const event of events) {
    const name = event.guestName?.trim();
    if (name && !isPlaceholderGuestName(name)) return name;
  }
  for (const event of events) {
    const code = event.confirmationCode?.trim();
    if (code) return `Reserva ${code}`;
  }
  return null;
}

function pickGroupField(
  events: OperationalFeedCard[],
  key: keyof Pick<
    OperationalFeedCard,
    "propertyLabel" | "propertyId" | "confirmationCode" | "dateRangeLabel"
  >,
): string | null {
  for (const event of events) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickReservationStatus(
  events: OperationalFeedCard[],
): ReservationStatus | null {
  for (const event of events) {
    if (event.reservationStatus) return event.reservationStatus;
  }
  return null;
}

export function groupOperationalFeedByReservation(
  cards: OperationalFeedCard[],
): OperationalFeedView {
  const byReservation = new Map<string, OperationalFeedCard[]>();
  const unlinked: OperationalFeedCard[] = [];

  for (const card of cards) {
    if (!card.reservationId) {
      unlinked.push(card);
      continue;
    }
    const list = byReservation.get(card.reservationId) ?? [];
    list.push(card);
    byReservation.set(card.reservationId, list);
  }

  const groups: OperationalFeedReservationGroup[] = [];

  for (const [reservationId, events] of byReservation) {
    const sortedEvents = [...events].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const attentionCount = sortedEvents.filter(
      (event) => event.priority === "attention",
    ).length;
    const rawGuestName = pickGroupGuestName(sortedEvents);
    const confirmationCode = pickGroupField(sortedEvents, "confirmationCode");
    const guestName = resolveNovedadesGuestName({
      guestName: rawGuestName,
      confirmationCode,
    });
    const reservationStatus = pickReservationStatus(sortedEvents);

    groups.push({
      reservationId,
      guestName,
      guestInitials: guestInitialsFromName(guestName),
      propertyLabel: pickGroupField(sortedEvents, "propertyLabel"),
      propertyId: pickGroupField(sortedEvents, "propertyId"),
      confirmationCode,
      dateRangeLabel: pickGroupField(sortedEvents, "dateRangeLabel"),
      reservationStatus,
      statusLabel: reservationStatus
        ? (RESERVATION_STATUS_LABELS[reservationStatus] ?? null)
        : null,
      latestAt: sortedEvents[0]?.createdAt ?? new Date(0).toISOString(),
      latestNarrative: sortedEvents[0]?.narrative ?? null,
      attentionCount,
      events: sortedEvents,
    });
  }

  groups.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  unlinked.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { groups, unlinked };
}
