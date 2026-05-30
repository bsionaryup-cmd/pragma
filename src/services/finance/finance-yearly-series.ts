import {
  PaymentStatus,
  PropertyStatus,
  ReservationStatus,
} from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { todayPrismaDate } from "@/lib/dates";
import { clampPercent } from "@/lib/format-currency";
import { db } from "@/lib/db";
import { loadReservationRevenueSourcesByReservationId } from "@/services/finance/reservation-revenue-context.service";
import { resolveReservationRevenueAmount } from "@/lib/finance/reservation-revenue-amount";
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

const ACCOUNTING: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
];

function monthRange(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function overlapsMonth(
  checkIn: Date,
  checkOut: Date,
  monthStart: Date,
  monthEnd: Date,
): boolean {
  return checkIn <= monthEnd && checkOut > monthStart;
}

function nightsInMonth(
  checkIn: Date,
  checkOut: Date,
  monthStart: Date,
  monthEnd: Date,
): number {
  const start = checkIn > monthStart ? checkIn : monthStart;
  const end = checkOut < monthEnd ? checkOut : monthEnd;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function buildFinanceYearlySeries(
  scope: TenantDataScope,
  year = new Date().getFullYear(),
): Promise<FinanceYearMonthPoint[]> {
  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const today = todayPrismaDate();

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
      reservations.map((row) => row.id),
    );

  const buckets = Array.from({ length: 12 }, (_, monthIndex) => {
    const { start, end } = monthRange(year, monthIndex);
    const isFuture = start > today;

    let revenue = 0;
    let pendingRevenue = 0;
    let expenses = 0;
    let bookedNights = 0;
    let paidReservations = 0;
    let pendingReservations = 0;

    for (const r of reservations) {
      if (!overlapsMonth(r.checkIn, r.checkOut, start, end)) continue;

      const amount = resolveReservationRevenueAmount({
        totalAmount: r.totalAmount,
        enrichedFields: revenueSourcesByReservationId.get(r.id)?.enrichedFields,
        payloadSignals: revenueSourcesByReservationId.get(r.id)?.payloadSignals,
        emailMatchBlob: revenueSourcesByReservationId.get(r.id)?.emailMatchBlob,
        payoutNet: revenueSourcesByReservationId.get(r.id)?.payoutNet,
      });
      const checkInInMonth = r.checkIn >= start && r.checkIn <= end;

      if (isReservationIncomePending(r.checkIn, r.paymentStatus, today)) {
        if (checkInInMonth) {
          pendingRevenue += amount;
          pendingReservations += 1;
        }
        bookedNights += nightsInMonth(r.checkIn, r.checkOut, start, end);
        continue;
      }

      if (
        isReservationIncomeConfirmed(r.checkIn, r.paymentStatus, today) &&
        checkInInMonth
      ) {
        revenue += amount;
        paidReservations += 1;
      }
      bookedNights += nightsInMonth(r.checkIn, r.checkOut, start, end);
    }

    if (!isFuture) {
      for (const row of manualExpenses) {
        if (row.expenseDate >= start && row.expenseDate <= end) {
          expenses += Number(row.amount);
        }
      }
      for (const row of manualIncomes) {
        if (row.incomeDate >= start && row.incomeDate <= end) {
          revenue += Number(row.amount);
        }
      }
    }

    const cancellations = cancelled.filter((r) =>
      overlapsMonth(r.checkIn, r.checkOut, start, end),
    ).length;

    const capacityNights =
      activeProperties > 0 ? activeProperties * daysInMonth(year, monthIndex) : 0;
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

  return buckets;
}
