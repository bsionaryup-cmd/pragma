import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";

/** Orden por fecha de creación (más recientes primero). */
export function sortByUpcomingArrivals(
  items: ReservationInboxItem[],
): ReservationInboxItem[] {
  return [...items].sort((a, b) => {
    const aCreated = a.createdAt ?? "";
    const bCreated = b.createdAt ?? "";
    const byCreated = bCreated.localeCompare(aCreated);
    if (byCreated !== 0) return byCreated;
    return b.id.localeCompare(a.id);
  });
}
