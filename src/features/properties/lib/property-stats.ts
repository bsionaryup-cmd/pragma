import type { ReservationStatus } from "@prisma/client";
import { PropertyStatus, ReservationStatus as Status } from "@prisma/client";
import { calculateOccupancy } from "@/lib/finance/calculate-occupancy";
import {
  financeMonthBounds,
  reservationNightsInMonth,
} from "@/lib/finance/finance-month-attribution";

const OCCUPANCY_STATUSES: ReservationStatus[] = [
  Status.CONFIRMED,
  Status.CHECKED_IN,
  Status.CHECKOUT_TODAY,
  Status.CHECKED_OUT,
];

type ReservationSlice = {
  id?: string;
  checkIn: Date;
  checkOut: Date;
  status: ReservationStatus;
  totalAmount?: { toString(): string };
  platform?: import("@prisma/client").BookingPlatform;
  icalUid?: string | null;
  reservationCode?: string | null;
};

/** Finance-aligned occupancy for a single property in a calendar month. */
export function computeMonthOccupancyPercent(
  reservations: ReservationSlice[],
  monthStart: Date,
  _monthEnd: Date,
  propertyStatus: PropertyStatus = PropertyStatus.ACTIVE,
): number {
  if (propertyStatus !== PropertyStatus.ACTIVE) return 0;

  const { startKey, endKey, daysInMonth } = financeMonthBounds(
    monthStart.getFullYear(),
    monthStart.getMonth(),
  );

  let blockedNights = 0;
  let occupiedNights = 0;

  for (const reservation of reservations) {
    if (reservation.status === Status.BLOCKED) {
      blockedNights += reservationNightsInMonth(
        reservation.checkIn,
        reservation.checkOut,
        startKey,
        endKey,
      );
      continue;
    }

    if (!OCCUPANCY_STATUSES.includes(reservation.status)) continue;

    occupiedNights += reservationNightsInMonth(
      reservation.checkIn,
      reservation.checkOut,
      startKey,
      endKey,
    );
  }

  const availableNights = Math.max(0, daysInMonth - blockedNights);
  return calculateOccupancy({ occupiedNights, availableNights });
}

export function sumMonthRevenue(
  reservations: ReservationSlice[],
  monthStart: Date,
  monthEnd: Date,
  resolveAmount?: (reservation: ReservationSlice) => number,
): number {
  let total = 0;

  for (const reservation of reservations) {
    if (reservation.status === "CANCELLED") continue;
    const checkIn = reservation.checkIn;
    if (checkIn < monthStart || checkIn > monthEnd) continue;
    if (resolveAmount) {
      total += resolveAmount(reservation);
      continue;
    }
    if (reservation.totalAmount) {
      total += Number(reservation.totalAmount.toString());
    }
  }

  return total;
}
