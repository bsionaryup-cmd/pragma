import { ReservationStatus } from "@prisma/client";
import { dateKeyToPrismaDate, prismaDateToKey, todayDateKeyInTimezone } from "@/lib/dates";
import {
  DEFAULT_CHECK_IN_TIME,
  DEFAULT_CHECK_OUT_TIME,
  resolveStayScheduleWindow,
} from "@/lib/stay-schedule";

export function deriveReservationStatusFromDates(
  checkIn: Date,
  checkOut: Date,
  options?: {
    blocked?: boolean;
    now?: Date;
    checkInTime?: string | null;
    checkOutTime?: string | null;
  },
): ReservationStatus {
  if (options?.blocked) return ReservationStatus.BLOCKED;

  const now = options?.now ?? new Date();
  const { validFrom, validTo } = resolveStayScheduleWindow({
    checkIn,
    checkOut,
    checkInTime: options?.checkInTime ?? DEFAULT_CHECK_IN_TIME,
    checkOutTime: options?.checkOutTime ?? DEFAULT_CHECK_OUT_TIME,
  });

  if (now >= validTo) {
    return ReservationStatus.CHECKED_OUT;
  }

  if (now < validFrom) {
    return ReservationStatus.CONFIRMED;
  }

  const checkoutDayKey = prismaDateToKey(checkOut);
  const todayKey = todayDateKeyInTimezone(now);
  if (checkoutDayKey === todayKey) {
    return ReservationStatus.CHECKOUT_TODAY;
  }

  return ReservationStatus.CHECKED_IN;
}

export function normalizeStayDates(checkIn: Date, checkOut: Date) {
  return {
    checkIn: dateKeyToPrismaDate(prismaDateToKey(checkIn)),
    checkOut: dateKeyToPrismaDate(prismaDateToKey(checkOut)),
  };
}
