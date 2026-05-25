import { GuestRegistrationStatus, ReservationStatus } from "@prisma/client";
import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";
import { getTodayKey } from "@/features/calendar/lib/calendar-dates";

/** Conversación pendiente de atención (registro huésped o llegada próxima). */
export function isInboxConversationUnread(
  reservation: ReservationInboxItem,
): boolean {
  if (reservation.status === ReservationStatus.CANCELLED) return false;
  if (reservation.status === ReservationStatus.BLOCKED) return false;

  if (reservation.guestRegistration?.status === GuestRegistrationStatus.ACTIVE) {
    return true;
  }

  const today = getTodayKey();
  const checkIn = reservation.checkIn;
  const daysUntil =
    (new Date(`${checkIn}T12:00:00`).getTime() -
      new Date(`${today}T12:00:00`).getTime()) /
    86_400_000;

  if (
    daysUntil >= 0 &&
    daysUntil <= 14 &&
    !reservation.guestRegistrationCompletedAt &&
    reservation.status === ReservationStatus.CONFIRMED
  ) {
    return true;
  }

  return false;
}
