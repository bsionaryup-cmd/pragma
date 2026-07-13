/** Calendar helpers for inventory intelligence (America/Bogota day buckets). */

const BOGOTA = "America/Bogota";

export function startOfBogotaDay(date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

export function daysAgoBogota(days: number, from = new Date()): Date {
  const base = startOfBogotaDay(from);
  base.setUTCDate(base.getUTCDate() - days);
  return base;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
