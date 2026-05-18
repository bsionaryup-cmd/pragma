import { ReservationStatus } from "@prisma/client";
import { dateKeyToPrismaDate, prismaDateToKey, startOfTodayUtc } from "@/lib/dates";

export function deriveReservationStatusFromDates(
  checkIn: Date,
  checkOut: Date,
  options?: { blocked?: boolean; today?: Date },
): ReservationStatus {
  if (options?.blocked) return ReservationStatus.BLOCKED;

  const today = options?.today ?? startOfTodayUtc();
  const inKey = prismaDateToKey(checkIn);
  const outKey = prismaDateToKey(checkOut);
  const todayKey = prismaDateToKey(today);

  if (outKey <= todayKey) {
    return ReservationStatus.CHECKED_OUT;
  }
  if (outKey === todayKey) {
    return ReservationStatus.CHECKOUT_TODAY;
  }
  if (inKey <= todayKey && outKey > todayKey) {
    return ReservationStatus.CHECKED_IN;
  }
  return ReservationStatus.CONFIRMED;
}

export function normalizeStayDates(checkIn: Date, checkOut: Date) {
  return {
    checkIn: dateKeyToPrismaDate(prismaDateToKey(checkIn)),
    checkOut: dateKeyToPrismaDate(prismaDateToKey(checkOut)),
  };
}
