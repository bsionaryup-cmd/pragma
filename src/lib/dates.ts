import { getZonedParts, PRAGMA_TIMEZONE } from "@/lib/timezone";

/** Fecha calendario ↔ columna Prisma @db.Date (siempre día UTC). */
export function prismaDateToKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateKeyToPrismaDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** YYYY-MM-DD del día operativo en la zona indicada (por defecto Colombia). */
export function todayDateKeyInTimezone(
  reference = new Date(),
  timeZone = PRAGMA_TIMEZONE,
): string {
  const { year, month, day } = getZonedParts(reference, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Hoy operativo como Date @db.Date (medianoche UTC del día calendario en Colombia). */
export function todayPrismaDate(reference = new Date()): Date {
  return dateKeyToPrismaDate(todayDateKeyInTimezone(reference));
}

export function addCalendarDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return prismaDateToKey(new Date(Date.UTC(y, m - 1, d + days)));
}

export function addCalendarDays(date: Date | string, days: number): Date {
  return dateKeyToPrismaDate(
    addCalendarDaysToKey(toReservationDateKey(date), days),
  );
}

/** @deprecated Usar todayPrismaDate — conservado por compatibilidad interna. */
export function startOfTodayUtc(): Date {
  return todayPrismaDate();
}

/** Normaliza Date Prisma @db.Date o string ISO/key a YYYY-MM-DD (fuente única). */
export function toReservationDateKey(date: Date | string): string {
  if (typeof date === "string") {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    return prismaDateToKey(new Date(trimmed));
  }
  return prismaDateToKey(date);
}

/** Fecha de estadía para formateo (sin drift de zona horaria). */
export function reservationDateForDisplay(date: Date | string): Date {
  return dateKeyToPrismaDate(toReservationDateKey(date));
}
