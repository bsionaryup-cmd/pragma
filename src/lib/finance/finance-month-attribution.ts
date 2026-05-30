import {
  addCalendarDaysToKey,
  dateKeyToPrismaDate,
  toReservationDateKey,
} from "@/lib/dates";

export function financeMonthDateKeys(year: number, monthIndex: number) {
  const monthNumber = monthIndex + 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const monthStr = String(monthNumber).padStart(2, "0");
  const startKey = `${year}-${monthStr}-01`;
  const endKey = `${year}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;
  return { startKey, endKey, daysInMonth, year, month: monthNumber };
}

/** Límites del mes calendario (monthIndex 0 = enero) como @db.Date. */
export function financeMonthBounds(year: number, monthIndex: number) {
  const keys = financeMonthDateKeys(year, monthIndex);
  return {
    start: dateKeyToPrismaDate(keys.startKey),
    end: dateKeyToPrismaDate(keys.endKey),
    startKey: keys.startKey,
    endKey: keys.endKey,
    daysInMonth: keys.daysInMonth,
    year: keys.year,
    month: keys.month,
  };
}

export function financeYearBounds(year: number) {
  const startMonth = financeMonthBounds(year, 0);
  const endMonth = financeMonthBounds(year, 11);
  return {
    start: startMonth.start,
    end: endMonth.end,
    startKey: startMonth.startKey,
    endKey: endMonth.endKey,
  };
}

/** Estadía solapa el mes (check-in inclusive, check-out exclusive). */
export function reservationOverlapsMonth(
  checkIn: Date,
  checkOut: Date,
  monthStartKey: string,
  monthEndKey: string,
): boolean {
  const checkInKey = toReservationDateKey(checkIn);
  const checkOutKey = toReservationDateKey(checkOut);
  return checkInKey <= monthEndKey && checkOutKey > monthStartKey;
}

/** Noches reservadas dentro del mes (check-in inclusive, check-out exclusive). */
export function reservationNightsInMonth(
  checkIn: Date,
  checkOut: Date,
  monthStartKey: string,
  monthEndKey: string,
): number {
  const stayStartKey = toReservationDateKey(checkIn);
  const stayEndKey = toReservationDateKey(checkOut);

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
  monthStartKey: string,
  monthEndKey: string,
): boolean {
  const checkInKey = toReservationDateKey(checkIn);
  return checkInKey >= monthStartKey && checkInKey <= monthEndKey;
}

/** Fecha calendario cae dentro del mes (ingresos/egresos manuales). */
export function calendarDateFallsInMonth(
  date: Date,
  monthStartKey: string,
  monthEndKey: string,
): boolean {
  const dateKey = toReservationDateKey(date);
  return dateKey >= monthStartKey && dateKey <= monthEndKey;
}
