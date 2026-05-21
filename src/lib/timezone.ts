/** Zona horaria canónica del sistema PRAGMA. */
export const PRAGMA_TIMEZONE = "America/Bogota";

export function getZonedParts(
  date: Date,
  timeZone = PRAGMA_TIMEZONE,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

/** Inicio del día en zona Bogotá, como Date UTC-instant. */
export function startOfDayInTimezone(
  reference = new Date(),
  timeZone = PRAGMA_TIMEZONE,
): Date {
  const { year, month, day } = getZonedParts(reference, timeZone);
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
}

export function monthBoundsInTimezone(
  reference = new Date(),
  timeZone = PRAGMA_TIMEZONE,
) {
  const { year, month } = getZonedParts(reference, timeZone);
  const start = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 28, 59, 59, 999));
  const prevStart = new Date(Date.UTC(year, month - 2, 1, 5, 0, 0, 0));
  const prevEnd = new Date(Date.UTC(year, month - 1, 0, 28, 59, 59, 999));
  const daysInMonth = end.getUTCDate();
  return { start, end, prevStart, prevEnd, daysInMonth, year, month };
}
