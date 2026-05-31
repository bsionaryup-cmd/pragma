import { addCalendarDaysToKey, toReservationDateKey } from "@/lib/dates";

export function monthKeyFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yearRaw, monthRaw] = monthKey.split("-");
  return { year: Number(yearRaw), month: Number(monthRaw) };
}

export function incrementMonthKey(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  if (month >= 12) return monthKeyFromParts(year + 1, 1);
  return monthKeyFromParts(year, month + 1);
}

/** Meses calendario (YYYY-MM) que una estadía toca (check-in inclusive, check-out exclusive). */
export function listMonthKeysForStay(
  checkIn: Date | string,
  checkOut: Date | string,
): string[] {
  const checkInKey =
    typeof checkIn === "string" ? checkIn : toReservationDateKey(checkIn);
  const checkOutKey =
    typeof checkOut === "string" ? checkOut : toReservationDateKey(checkOut);

  if (checkOutKey <= checkInKey) return [];

  const lastNightKey = addCalendarDaysToKey(checkOutKey, -1);
  const keys: string[] = [];
  let cursor = checkInKey.slice(0, 7);
  const endMonth = lastNightKey.slice(0, 7);

  while (cursor <= endMonth) {
    keys.push(cursor);
    cursor = incrementMonthKey(cursor);
  }

  return keys;
}

export function listMonthKeysForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    monthKeyFromParts(year, index + 1),
  );
}

export function unionMonthKeys(...groups: string[][]): string[] {
  return [...new Set(groups.flat())].sort();
}
