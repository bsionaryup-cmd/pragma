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

export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
