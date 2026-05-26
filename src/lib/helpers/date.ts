import { toReservationDateKey } from "@/lib/dates";
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

/** Fecha y hora en es-CO con zona fija; evita mismatches de hidratación SSR/cliente. */
export function formatDateTime(
  date: Date | string | null | undefined,
  fallback = "—",
): string {
  if (!date) return fallback;
  const value = typeof date === "string" ? new Date(date) : date;
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

export function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayDiff(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Etiqueta relativa para tablas del panel (ej. Mañana, 19 may). */
export function formatPanelDate(date: Date | string): string {
  const targetKey = toReservationDateKey(date);
  const todayKey = toReservationDateKey(startOfDay());
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const [y, m, d] = targetKey.split("-").map(Number);
  const diff = Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );

  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(".", "");
}
