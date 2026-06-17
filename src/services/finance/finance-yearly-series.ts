import {
  PropertyStatus,
  ReservationStatus,
} from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { todayPrismaDate, toReservationDateKey } from "@/lib/dates";
import { clampPercent } from "@/lib/format-currency";
import { db } from "@/lib/db";
import {
  checkInFallsInMonth,
  calendarDateFallsInMonth,
  financeMonthBounds,
  financeYearBounds,
  reservationNightsInMonth,
  reservationOverlapsMonth,
} from "@/lib/finance/finance-month-attribution";
import { loadReservationRevenueSourcesByReservationId } from "@/services/finance/reservation-revenue-context.service";
import { resolveFinanceReservationRevenueAmount } from "@/lib/finance/reservation-revenue-amount";
import {
  isReservationIncomeConfirmed,
  isReservationIncomePending,
} from "@/lib/finance/reservation-income-status";
import { mergePropertyScope, mergeReservationScope } from "@/lib/platform/tenant-data-scope";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import {
  listManualExpensesInRange,
  listOtherIncomesInRange,
} from "@/services/finance/finance-prisma-guard";
import { partitionOtherIncomes } from "@/lib/finance/other-income-policy";

export const FINANCE_YEAR_MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export type FinanceYearMonthPoint = {
  monthIndex: number;
  label: string;
  revenue: number;
  pendingRevenue: number;
  expenses: number;
  occupancy: number;
  paidReservations: number;
  pendingReservations: number;
  cancellations: number;
  /** Mes futuro dentro del año en curso. */
  isFuture: boolean;
};

export type FinanceYearlySeriesResult = {
  months: FinanceYearMonthPoint[];
  /** Ingresos confirmados por check-in en el año hasta hoy (sin doble conteo). */
  yearToDateRevenue: number;
};

const ACCOUNTING: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
];

export async function buildFinanceYearlySeries(
  scope: TenantDataScope,
  year = new Date().getFullYear(),
): Promise<FinanceYearlySeriesResult> {
  const { start: yearStart, end: yearEnd } = financeYearBounds(year);
  const today = todayPrismaDate();
  const yearStartKey = toReservationDateKey(yearStart);

  const yearEndKey = toReservationDateKey(yearEnd);

  const [reservations, cancelled, manualExpenses, manualIncomes, activeProperties] =
    await Promise.all([
      db.reservation.findMany({
        where: withVisibleReservationsFilter(
          mergeReservationScope(scope, {
            status: { in: ACCOUNTING },
            checkIn: { lte: yearEnd },
            checkOut: { gte: yearStart },
          }),
        ),
        select: {
          id: true,
          totalAmount: true,
          paymentStatus: true,
          checkIn: true,
          checkOut: true,
          platform: true,
          icalUid: true,
          reservationCode: true,
          property: { select: { cleaningFee: true } },
        },
      }),
      db.reservation.findMany({
        where: withVisibleReservationsFilter(
          mergeReservationScope(scope, {
            status: ReservationStatus.CANCELLED,
            checkIn: { lte: yearEnd },
            checkOut: { gte: yearStart },
          }),
        ),
        select: { checkIn: true, checkOut: true },
      }),
      listManualExpensesInRange(yearStart, yearEnd, scope),
      listOtherIncomesInRange(yearStart, yearEnd, scope),
      db.property.count({
        where: mergePropertyScope(scope, { status: PropertyStatus.ACTIVE }),
      }),
    ]);

  const revenueSourcesByReservationId =
    await loadReservationRevenueSourcesByReservationId(
      reservations
        .filter((row) => {
          const checkInKey = toReservationDateKey(row.checkIn);
          return checkInKey >= yearStartKey && checkInKey <= yearEndKey;
        })
        .map((row) => row.id),
    );

  const { operational: manualIncomesOperational } =
    partitionOtherIncomes(manualIncomes);

  const buckets = Array.from({ length: 12 }, (_, monthIndex) => {
    const { startKey, endKey, daysInMonth } = financeMonthBounds(year, monthIndex);
    const isFuture = startKey > toReservationDateKey(today);

    let revenue = 0;
    let pendingRevenue = 0;
    let expenses = 0;
    let bookedNights = 0;
    let paidReservations = 0;
    let pendingReservations = 0;

    for (const r of reservations) {
      if (reservationOverlapsMonth(r.checkIn, r.checkOut, startKey, endKey)) {
        bookedNights += reservationNightsInMonth(r.checkIn, r.checkOut, startKey, endKey);
      }

      if (!checkInFallsInMonth(r.checkIn, startKey, endKey)) continue;

      const amount = resolveFinanceReservationRevenueAmount(
        r,
        revenueSourcesByReservationId.get(r.id),
      );

      if (isReservationIncomePending(r.checkIn, r.paymentStatus, today)) {
        pendingRevenue += amount;
        pendingReservations += 1;
        continue;
      }

      if (isReservationIncomeConfirmed(r.checkIn, r.paymentStatus, today)) {
        revenue += amount;
        paidReservations += 1;
      }
    }

    if (!isFuture) {
      for (const row of manualExpenses) {
        if (calendarDateFallsInMonth(row.expenseDate, startKey, endKey)) {
          expenses += Number(row.amount);
        }
      }
      for (const row of manualIncomesOperational) {
        if (calendarDateFallsInMonth(row.incomeDate, startKey, endKey)) {
          revenue += Number(row.amount);
        }
      }
    }

    const cancellations = cancelled.filter((r) =>
      reservationOverlapsMonth(r.checkIn, r.checkOut, startKey, endKey),
    ).length;

    const capacityNights =
      activeProperties > 0 ? activeProperties * daysInMonth : 0;
    const occupancy =
      capacityNights > 0
        ? clampPercent((bookedNights / capacityNights) * 100)
        : 0;

    return {
      monthIndex,
      label: FINANCE_YEAR_MONTH_LABELS[monthIndex],
      revenue: Math.round(revenue),
      pendingRevenue: Math.round(pendingRevenue),
      expenses: Math.round(expenses),
      occupancy,
      paidReservations,
      pendingReservations,
      cancellations,
      isFuture,
    };
  });

  return {
    months: buckets,
    yearToDateRevenue: Math.round(
      buckets.filter((m) => !m.isFuture).reduce((sum, m) => sum + m.revenue, 0),
    ),
  };
}
