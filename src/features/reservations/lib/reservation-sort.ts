import { ReservationStatus } from "@prisma/client";
import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";

/** Orden cronológico por check-in; canceladas al final. */
export function sortByUpcomingArrivals(
  items: ReservationInboxItem[],
): ReservationInboxItem[] {
  return [...items].sort((a, b) => {
    const aCancelled = a.status === ReservationStatus.CANCELLED;
    const bCancelled = b.status === ReservationStatus.CANCELLED;
    if (aCancelled !== bCancelled) return aCancelled ? 1 : -1;
    return a.checkIn.localeCompare(b.checkIn);
  });
}
