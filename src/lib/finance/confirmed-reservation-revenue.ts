import type { BookingPlatform, PaymentStatus } from "@prisma/client";
import { isReservationIncomeConfirmed } from "@/lib/finance/reservation-income-status";
import {
  resolveFinanceReservationRevenueAmount,
  type ReservationRevenueSources,
} from "@/lib/finance/reservation-revenue-amount";

export type ConfirmedReservationRevenueRow = {
  id: string;
  totalAmount: unknown;
  platform: BookingPlatform;
  icalUid: string | null;
  reservationCode: string | null;
  checkIn: Date;
  paymentStatus: PaymentStatus;
};

/** Same confirmed-income rule as Finanzas (check-in occurred, finance resolver). */
export function sumConfirmedReservationRevenue(
  reservations: ConfirmedReservationRevenueRow[],
  revenueSourcesByReservationId: Map<string, ReservationRevenueSources>,
  today: Date,
): number {
  return reservations.reduce((sum, reservation) => {
    if (!isReservationIncomeConfirmed(reservation.checkIn, reservation.paymentStatus, today)) {
      return sum;
    }
    return (
      sum +
      resolveFinanceReservationRevenueAmount(
        reservation,
        revenueSourcesByReservationId.get(reservation.id),
      )
    );
  }, 0);
}
