import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";

function reservationCreatedAtMs(item: ReservationInboxItem): number {
  if (!item.createdAt) return 0;
  const ms = Date.parse(item.createdAt);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Orden por fecha de creación (más recientes primero). */
export function sortByUpcomingArrivals(
  items: ReservationInboxItem[],
): ReservationInboxItem[] {
  return [...items].sort((a, b) => {
    const byCreated = reservationCreatedAtMs(b) - reservationCreatedAtMs(a);
    if (byCreated !== 0) return byCreated;
    return b.id.localeCompare(a.id);
  });
}
