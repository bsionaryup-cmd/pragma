import type {
  OperationalFeedCard,
  OperationalFeedReservationGroup,
  OperationalFeedView,
} from "@/services/novedades/operational-feed.types";

function pickGroupGuestName(events: OperationalFeedCard[]): string | null {
  for (const event of events) {
    if (event.guestName?.trim()) return event.guestName.trim();
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

    groups.push({
      reservationId,
      guestName: pickGroupGuestName(sortedEvents),
      propertyLabel: pickGroupField(sortedEvents, "propertyLabel"),
      propertyId: pickGroupField(sortedEvents, "propertyId"),
      confirmationCode: pickGroupField(sortedEvents, "confirmationCode"),
      dateRangeLabel: pickGroupField(sortedEvents, "dateRangeLabel"),
      latestAt: sortedEvents[0]?.createdAt ?? new Date(0).toISOString(),
      attentionCount,
      events: sortedEvents,
    });
  }

  groups.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  unlinked.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { groups, unlinked };
}
