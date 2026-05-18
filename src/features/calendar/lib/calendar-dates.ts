import type {
  CalendarDayMeta,
  CalendarViewport,
} from "@/features/calendar/types/calendar.types";
import { CALENDAR_DAY_WIDTH } from "@/features/calendar/constants";
import {
  dateKeyToPrismaDate,
  prismaDateToKey,
  startOfTodayUtc,
} from "@/lib/dates";

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;

/** Días visibles antes del ancla (hoy por defecto). */
export const CALENDAR_DAYS_BEFORE = 3;
/** Días visibles después del ancla. */
export const CALENDAR_DAYS_AFTER = 56;

export function toDateKey(date: Date): string {
  return prismaDateToKey(date);
}

export function parseDateKey(key: string): Date {
  return dateKeyToPrismaDate(key);
}

export function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addDaysToKey(key: string, days: number): string {
  return prismaDateToKey(addDaysUtc(dateKeyToPrismaDate(key), days));
}

export function differenceInCalendarDays(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((utcA - utcB) / msPerDay);
}

export function getTodayKey(): string {
  return prismaDateToKey(startOfTodayUtc());
}

function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = dateKeyToPrismaDate(key);
  return prismaDateToKey(d) === key;
}

export function resolveCalendarAnchor(anchorParam?: string): string {
  if (anchorParam && isValidDateKey(anchorParam)) {
    return anchorParam;
  }
  return getTodayKey();
}

export function shiftAnchor(anchorKey: string, days: number): string {
  return addDaysToKey(anchorKey, days);
}

/** Ventana deslizante centrada en el ancla (por defecto hoy). */
export function buildRollingCalendarViewport(
  anchorKey?: string,
  daysBefore = CALENDAR_DAYS_BEFORE,
  daysAfter = CALENDAR_DAYS_AFTER,
): CalendarViewport {
  const todayKey = getTodayKey();
  const anchor = anchorKey && isValidDateKey(anchorKey) ? anchorKey : todayKey;
  const anchorDate = dateKeyToPrismaDate(anchor);
  const rangeStartDate = addDaysUtc(anchorDate, -daysBefore);
  const rangeEndDate = addDaysUtc(anchorDate, daysAfter);

  const [y, m] = anchor.split("-").map(Number);
  const days: CalendarDayMeta[] = [];
  let cursor = rangeStartDate;

  while (cursor <= rangeEndDate) {
    const dateKey = prismaDateToKey(cursor);
    const utcDay = cursor.getUTCDay();
    const dayOfWeek = utcDay === 0 ? 6 : utcDay - 1;
    const isCurrentMonth =
      cursor.getUTCMonth() === m - 1 && cursor.getUTCFullYear() === y;

    days.push({
      date: dateKey,
      dayOfMonth: cursor.getUTCDate(),
      dayOfWeek,
      isToday: dateKey === todayKey,
      isWeekend: utcDay === 0 || utcDay === 6,
      isCurrentMonth,
      label: String(cursor.getUTCDate()),
      weekdayShort: WEEKDAY_SHORT[utcDay],
    });

    cursor = addDaysUtc(cursor, 1);
  }

  return {
    anchor,
    year: y,
    month: m,
    rangeStart: prismaDateToKey(rangeStartDate),
    rangeEnd: prismaDateToKey(rangeEndDate),
    days,
    gridWidth: days.length * CALENDAR_DAY_WIDTH,
  };
}

/** @deprecated Usar buildRollingCalendarViewport */
export function buildCalendarViewport(
  year: number,
  month: number,
): CalendarViewport {
  const anchor = `${year}-${String(month).padStart(2, "0")}-15`;
  return buildRollingCalendarViewport(anchor, 14, 45);
}

export function formatViewportRangeLabel(viewport: CalendarViewport): string {
  const start = dateKeyToPrismaDate(viewport.rangeStart);
  const end = dateKeyToPrismaDate(viewport.rangeEnd);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const startLabel = fmt(start);
  const endLabel = fmt(end);
  const year = end.getUTCFullYear();
  return `${startLabel} – ${endLabel} ${year}`;
}

export function formatMonthYear(year: number, month: number): string {
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "es-CO",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function resolveYearMonth(
  yearParam?: string,
  monthParam?: string,
): { year: number; month: number } {
  const today = getTodayKey();
  const [y, m] = today.split("-").map(Number);
  const year = yearParam ? Number(yearParam) : y;
  const month = monthParam ? Number(monthParam) : m;

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return { year: y, month: m };
  }

  return { year, month };
}
