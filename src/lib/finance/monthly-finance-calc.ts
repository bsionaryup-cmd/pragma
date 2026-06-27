import { PropertyStatus, ReservationStatus, PaymentStatus } from "@prisma/client";
import { clampPercent } from "@/lib/format-currency";
import {
  checkInFallsInMonth,
  financeMonthBounds,
  reservationNightsInMonth,
} from "@/lib/finance/finance-month-attribution";
import { parseMonthKey } from "@/lib/finance/monthly-finance-month-keys";
import {
  isReservationIncomeConfirmed,
  isReservationIncomePending,
} from "@/lib/finance/reservation-income-status";
import {
  resolveFinanceReservationRevenueAmount,
  type ReservationRevenueSources,
} from "@/lib/finance/reservation-revenue-amount";
import type { BookingPlatform } from "@prisma/client";

const OCCUPANCY_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
];

export type MonthlyFinanceReservationRow = {
  id: string;
  propertyId: string;
  status: ReservationStatus;
  checkIn: Date;
  checkOut: Date;
  totalAmount: unknown;
  paymentStatus: PaymentStatus;
  platform: BookingPlatform;
  icalUid: string | null;
  reservationCode: string | null;
};

export type MonthlyFinancePropertyRow = {
  id: string;
  status: PropertyStatus;
};

export type MonthlyFinancePropertyMetric = {
  propertyId: string;
  availableNights: number;
  occupiedNights: number;
  occupancyPct: number;
  grossRevenue: number;
  projectedRevenue: number;
};

export function computeMonthlyFinancePropertyMetric(
  property: MonthlyFinancePropertyRow,
  monthKey: string,
  reservations: MonthlyFinanceReservationRow[],
  revenueSourcesByReservationId: Map<string, ReservationRevenueSources>,
  today: Date,
): MonthlyFinancePropertyMetric {
  const { year, month } = parseMonthKey(monthKey);
  const { startKey, endKey, daysInMonth } = financeMonthBounds(year, month - 1);

  if (property.status !== PropertyStatus.ACTIVE) {
    return {
      propertyId: property.id,
      availableNights: 0,
      occupiedNights: 0,
      occupancyPct: 0,
      grossRevenue: 0,
      projectedRevenue: 0,
    };
  }

  let blockedNights = 0;
  let occupiedNights = 0;
  let grossRevenue = 0;
  let projectedRevenue = 0;

  for (const reservation of reservations) {
    if (reservation.propertyId !== property.id) continue;

    if (reservation.status === ReservationStatus.BLOCKED) {
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

    if (!checkInFallsInMonth(reservation.checkIn, startKey, endKey)) continue;

    const amount = resolveFinanceReservationRevenueAmount(
      {
        totalAmount: reservation.totalAmount,
        platform: reservation.platform,
        icalUid: reservation.icalUid,
        reservationCode: reservation.reservationCode,
      },
      revenueSourcesByReservationId.get(reservation.id),
    );

    if (
      isReservationIncomeConfirmed(
        reservation.checkIn,
        reservation.paymentStatus,
        today,
      )
    ) {
      grossRevenue += amount;
      projectedRevenue += amount;
      continue;
    }

    if (
      isReservationIncomePending(
        reservation.checkIn,
        reservation.paymentStatus,
        today,
      )
    ) {
      projectedRevenue += amount;
    }
  }

  const availableNights = Math.max(0, daysInMonth - blockedNights);
  const occupancyPct =
    availableNights > 0
      ? clampPercent((occupiedNights / availableNights) * 100)
      : 0;

  return {
    propertyId: property.id,
    availableNights,
    occupiedNights,
    occupancyPct,
    grossRevenue: Math.round(grossRevenue),
    projectedRevenue: Math.round(projectedRevenue),
  };
}

export type MonthlyFinanceAggregate = {
  availableNights: number;
  occupiedNights: number;
  occupancyPct: number;
  grossRevenue: number;
  projectedRevenue: number;
};

export function aggregateMonthlyFinanceMetrics(
  rows: MonthlyFinancePropertyMetric[],
): MonthlyFinanceAggregate {
  const availableNights = rows.reduce((sum, row) => sum + row.availableNights, 0);
  const occupiedNights = rows.reduce((sum, row) => sum + row.occupiedNights, 0);
  const grossRevenue = rows.reduce((sum, row) => sum + row.grossRevenue, 0);
  const projectedRevenue = rows.reduce(
    (sum, row) => sum + row.projectedRevenue,
    0,
  );
  const occupancyPct =
    availableNights > 0
      ? clampPercent((occupiedNights / availableNights) * 100)
      : 0;

  return {
    availableNights,
    occupiedNights,
    occupancyPct,
    grossRevenue,
    projectedRevenue,
  };
}
