import type { ReservationStatus } from "@prisma/client";

type ReservationSlice = {
  checkIn: Date;
  checkOut: Date;
  status: ReservationStatus;
  totalAmount?: { toString(): string };
};

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeMonthOccupancyPercent(
  reservations: ReservationSlice[],
  monthStart: Date,
  monthEnd: Date,
): number {
  const daysInMonth = monthEnd.getDate();
  if (daysInMonth <= 0) return 0;

  let occupiedNights = 0;

  for (const reservation of reservations) {
    if (reservation.status === "CANCELLED") continue;

    const checkIn = startOfDay(reservation.checkIn);
    const checkOut = startOfDay(reservation.checkOut);
    const visibleStart = checkIn < monthStart ? monthStart : checkIn;
    const visibleEnd = checkOut > monthEnd ? monthEnd : checkOut;

    if (visibleEnd <= visibleStart) continue;

    const nights = Math.round(
      (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    occupiedNights += nights;
  }

  return Math.min(100, Math.round((occupiedNights / daysInMonth) * 100));
}

export function sumMonthRevenue(
  reservations: ReservationSlice[],
  monthStart: Date,
  monthEnd: Date,
): number {
  let total = 0;

  for (const reservation of reservations) {
    if (reservation.status === "CANCELLED") continue;
    const checkIn = startOfDay(reservation.checkIn);
    if (checkIn < monthStart || checkIn > monthEnd) continue;
    if (reservation.totalAmount) {
      total += Number(reservation.totalAmount.toString());
    }
  }

  return total;
}
