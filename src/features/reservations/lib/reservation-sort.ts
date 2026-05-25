import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";

/** Orden por fecha de creación (más recientes primero). */
export function sortByUpcomingArrivals(
  items: ReservationInboxItem[],
): ReservationInboxItem[] {
  return [...items].sort((a, b) => {
    const aCreated = a.createdAt ?? "";
    const bCreated = b.createdAt ?? "";
    return bCreated.localeCompare(aCreated);
  });
}
