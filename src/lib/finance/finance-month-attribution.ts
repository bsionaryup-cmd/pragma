import { addCalendarDaysToKey, toReservationDateKey } from "@/lib/dates";
import { monthBoundsInTimezone } from "@/lib/timezone";

/** Límites del mes calendario en zona Bogotá (monthIndex 0 = enero). */
export function financeMonthBounds(year: number, monthIndex: number) {
  const reference = new Date(Date.UTC(year, monthIndex, 15, 12, 0, 0, 0));
  return monthBoundsInTimezone(reference);
}

export function financeYearBounds(year: number) {
  const startMonth = financeMonthBounds(year, 0);
  const endMonth = financeMonthBounds(year, 11);
  return {
    start: startMonth.start,
    end: endMonth.end,
    daysInDecember: endMonth.daysInMonth,
  };
}

/** Estadía solapa el mes (check-in inclusive, check-out exclusive). */
export function reservationOverlapsMonth(
  checkIn: Date,
  checkOut: Date,
  monthStart: Date,
  monthEnd: Date,
): boolean {
  const checkInKey = toReservationDateKey(checkIn);
  const checkOutKey = toReservationDateKey(checkOut);
  const monthStartKey = toReservationDateKey(monthStart);
  const monthEndKey = toReservationDateKey(monthEnd);
  return checkInKey <= monthEndKey && checkOutKey > monthStartKey;
}

/** Noches reservadas dentro del mes (check-in inclusive, check-out exclusive). */
export function reservationNightsInMonth(
  checkIn: Date,
  checkOut: Date,
  monthStart: Date,
  monthEnd: Date,
): number {
  const stayStartKey = toReservationDateKey(checkIn);
  const stayEndKey = toReservationDateKey(checkOut);
  const monthStartKey = toReservationDateKey(monthStart);
  const monthEndKey = toReservationDateKey(monthEnd);

  let cursor =
    stayStartKey > monthStartKey ? stayStartKey : monthStartKey;
  const lastNightKey =
    stayEndKey < addCalendarDaysToKey(monthEndKey, 1)
      ? addCalendarDaysToKey(stayEndKey, -1)
      : monthEndKey;

  if (cursor > lastNightKey) return 0;

  let nights = 0;
  while (cursor <= lastNightKey) {
    if (cursor >= stayStartKey && cursor < stayEndKey) nights += 1;
    cursor = addCalendarDaysToKey(cursor, 1);
  }
  return nights;
}

/** Check-in cae dentro del mes calendario (por clave YYYY-MM-DD). */
export function checkInFallsInMonth(
  checkIn: Date,
  monthStart: Date,
  monthEnd: Date,
): boolean {
  const checkInKey = toReservationDateKey(checkIn);
  const monthStartKey = toReservationDateKey(monthStart);
  const monthEndKey = toReservationDateKey(monthEnd);
  return checkInKey >= monthStartKey && checkInKey <= monthEndKey;
}
