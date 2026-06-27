import { ReservationStatus } from "@prisma/client";
import { deriveReservationStatusFromDates } from "@/services/reservations/reservation-status";

/**
 * Calendar bar status for presentation only — does not persist to the database.
 * Ensures completed stays render as CHECKED_OUT regardless of OTA sync lag.
 */
export function resolveCalendarBarStatus(
  storedStatus: ReservationStatus,
  checkIn: Date,
  checkOut: Date,
): ReservationStatus {
  if (
    storedStatus === ReservationStatus.BLOCKED ||
    storedStatus === ReservationStatus.CANCELLED
  ) {
    return storedStatus;
  }

  const derivedStatus = deriveReservationStatusFromDates(checkIn, checkOut);

  if (derivedStatus === ReservationStatus.CHECKED_OUT) {
    return ReservationStatus.CHECKED_OUT;
  }

  if (storedStatus === ReservationStatus.CHECKED_OUT) {
    return ReservationStatus.CHECKED_OUT;
  }

  if (
    storedStatus === ReservationStatus.CHECKED_IN ||
    storedStatus === ReservationStatus.CHECKOUT_TODAY
  ) {
    return storedStatus;
  }

  return derivedStatus;
}
