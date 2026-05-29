import {
  dateKeyToPrismaDate,
  todayDateKeyInTimezone,
  toReservationDateKey,
} from "@/lib/dates";
import { PRAGMA_TIMEZONE } from "@/lib/timezone";

const DEFAULT_TIMEZONE = PRAGMA_TIMEZONE;

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const key = toReservationDateKey(date);
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Fecha y hora en es-CO con zona fija Bogotá; evita mismatches SSR/cliente y drift UTC. */
export function formatDateTime(
  date: Date | string | null | undefined,
  fallback = "—",
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return fallback;
  const value = typeof date === "string" ? new Date(date) : date;

  if (options) {
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: DEFAULT_TIMEZONE,
      ...options,
    }).format(value);
  }

  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: DEFAULT_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(value);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const dayPeriod = read("dayPeriod").replace(/\u00a0|\u202f/g, " ").trim();

  return `${read("day")}/${read("month")}/${read("year")}, ${read("hour")}:${read("minute")} ${dayPeriod}`;
}

export function formatDateRange(checkIn: Date, checkOut: Date): string {
  return `${formatDate(checkIn)} → ${formatDate(checkOut)}`;
}

/** Día calendario @db.Date. Sin argumento = hoy operativo en Colombia. */
export function startOfDay(date?: Date | string): Date {
  if (date === undefined) {
    return dateKeyToPrismaDate(todayDateKeyInTimezone());
  }
  return dateKeyToPrismaDate(toReservationDateKey(date));
}

function dayDiff(from: Date, to: Date): number {
  const a = toReservationDateKey(from);
  const b = toReservationDateKey(to);
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}

/** Etiqueta relativa para tablas del panel (ej. Mañana, 19 may). */
export function formatPanelDate(date: Date | string): string {
  const targetKey = toReservationDateKey(date);
  const todayKey = todayDateKeyInTimezone();
  const diff = dayDiff(dateKeyToPrismaDate(todayKey), dateKeyToPrismaDate(targetKey));

  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";

  const [y, m, d] = targetKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(".", "");
}
