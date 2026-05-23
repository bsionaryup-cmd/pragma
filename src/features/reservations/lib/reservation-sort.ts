import { ReservationStatus } from "@prisma/client";
import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Próximas llegadas primero; canceladas al final; pasadas después de futuras. */
export function sortByUpcomingArrivals(
  items: ReservationInboxItem[],
): ReservationInboxItem[] {
  const today = todayKey();
  return [...items].sort((a, b) => {
    const aCancelled = a.status === ReservationStatus.CANCELLED;
    const bCancelled = b.status === ReservationStatus.CANCELLED;
    if (aCancelled !== bCancelled) return aCancelled ? 1 : -1;

    const aUpcoming = a.checkIn >= today;
    const bUpcoming = b.checkIn >= today;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

    if (aUpcoming && bUpcoming) return a.checkIn.localeCompare(b.checkIn);
    return b.checkIn.localeCompare(a.checkIn);
  });
}
