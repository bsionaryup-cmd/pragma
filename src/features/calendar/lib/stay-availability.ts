import { addDaysToKey } from "@/features/calendar/lib/calendar-dates";

export type StayRangeLike = {
  checkIn: string;
  checkOut: string;
  status: string;
  guestName?: string;
};

/** Noche ocupada por reserva/bloqueo: [checkIn, checkOut) — el día de salida queda libre. */
export function isActiveStayStatus(status: string): boolean {
  return status !== "CANCELLED";
}

export function isNightOccupiedByStay(
  dateKey: string,
  stay: StayRangeLike,
): boolean {
  if (!isActiveStayStatus(stay.status)) return false;
  return dateKey >= stay.checkIn && dateKey < stay.checkOut;
}

export function isNightOccupiedByStays(
  dateKey: string,
  stays: StayRangeLike[],
): boolean {
  return stays.some((stay) => isNightOccupiedByStay(dateKey, stay));
}

/**
 * Día bajo la banda diagonal gris (incluye checkout visual).
 * La selección sigue usando isNightOccupiedByStays ([checkIn, checkOut)).
 */
export function isDayInOccupancyBandVisual(
  dateKey: string,
  stays: StayRangeLike[],
): boolean {
  return stays.some(
    (stay) =>
      isActiveStayStatus(stay.status) &&
      dateKey >= stay.checkIn &&
      dateKey <= stay.checkOut,
  );
}

export function isNightExternallyBooked(
  dateKey: string,
  isBooked: boolean,
  stays: StayRangeLike[],
): boolean {
  return isBooked && !isNightOccupiedByStays(dateKey, stays);
}

export function isNightUnavailable(
  dateKey: string,
  stays: StayRangeLike[],
  isBooked = false,
): boolean {
  return isNightOccupiedByStays(dateKey, stays) || isBooked;
}

/** Solapamiento estándar PMS: [checkIn, checkOut) */
export function stayRangesOverlap(
  checkInA: string,
  checkOutA: string,
  checkInB: string,
  checkOutB: string,
): boolean {
  return checkInA < checkOutB && checkOutA > checkInB;
}

export function findStayRangeConflict(
  checkIn: string,
  checkOut: string,
  stays: StayRangeLike[],
): StayRangeLike | null {
  return (
    stays.find(
      (stay) =>
        isActiveStayStatus(stay.status) &&
        stayRangesOverlap(checkIn, checkOut, stay.checkIn, stay.checkOut),
    ) ?? null
  );
}

export function isStayRangeAvailable(
  checkIn: string,
  checkOut: string,
  stays: StayRangeLike[],
  isNightBooked?: (dateKey: string) => boolean,
): boolean {
  if (checkOut <= checkIn) return false;

  let night = checkIn;
  while (night < checkOut) {
    if (isNightUnavailable(night, stays, isNightBooked?.(night) ?? false)) {
      return false;
    }
    night = addDaysToKey(night, 1);
  }

  return true;
}

/** Recorta el checkout al último día válido sin cruzar noches ocupadas. */
export function clampSelectableCheckOut(
  checkIn: string,
  requestedCheckOut: string,
  stays: StayRangeLike[],
  isNightBooked?: (dateKey: string) => boolean,
): string | null {
  if (requestedCheckOut <= checkIn) return null;

  let candidate = requestedCheckOut;
  while (candidate > checkIn) {
    if (isStayRangeAvailable(checkIn, candidate, stays, isNightBooked)) {
      return candidate;
    }
    candidate = addDaysToKey(candidate, -1);
  }

  return null;
}

export function formatCalendarStayConflictMessage(conflict: StayRangeLike): string {
  if (conflict.status === "BLOCKED") {
    return `Las fechas están bloqueadas (${conflict.checkIn} → ${conflict.checkOut}). Elige otras fechas.`;
  }
  const guest = conflict.guestName?.trim() || "otra reserva";
  return `Las fechas chocan con «${guest}» (${conflict.checkIn} → ${conflict.checkOut}). Elige otras fechas.`;
}
