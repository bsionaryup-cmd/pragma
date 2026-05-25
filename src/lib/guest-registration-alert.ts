import { startOfDay } from "@/lib/helpers/date";

function parseCheckInDay(checkIn: string | Date): Date {
  if (checkIn instanceof Date) return startOfDay(checkIn);
  return startOfDay(new Date(`${String(checkIn).slice(0, 10)}T12:00:00`));
}

function calendarDaysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

/** Reserva con check-in en ≤2 días y registro de huéspedes incompleto. */
export function isGuestRegistrationDueSoon(input: {
  checkIn: string | Date;
  guestRegistrationCompletedAt?: string | Date | null;
  registrationComplete?: boolean;
}): boolean {
  if (input.registrationComplete) return false;
  if (input.guestRegistrationCompletedAt) return false;

  const checkIn = parseCheckInDay(input.checkIn);
  const today = startOfDay(new Date());
  const daysUntil = calendarDaysBetween(today, checkIn);

  return daysUntil >= 0 && daysUntil <= 2;
}
