const DEFAULT_TIMEZONE = "America/Bogota";

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: DEFAULT_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(value);
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
  const value = typeof date === "string" ? new Date(date) : date;
  const today = startOfDay();
  const target = startOfDay(value);
  const diff = dayDiff(today, target);

  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: DEFAULT_TIMEZONE,
    day: "numeric",
    month: "short",
  })
    .format(target)
    .replace(".", "");
}
