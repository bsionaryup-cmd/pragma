import { PropertyStatus, ReservationStatus, PaymentStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { prismaDateToKey, todayPrismaDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { clampPercent, formatMoney } from "@/lib/format-currency";
import { formatPropertyLabel } from "@/lib/property-display";
import { monthBoundsInTimezone } from "@/lib/timezone";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  mergePropertyScope,
  mergeReservationScope,
} from "@/lib/platform/tenant-data-scope";
import { getManualFinanceInRange } from "@/services/finance/finance-manual-totals";
import { loadReservationRevenueSourcesByReservationId } from "@/services/finance/reservation-revenue-context.service";
import { resolveReservationRevenueAmount } from "@/lib/finance/reservation-revenue-amount";
import {
  isReservationIncomeConfirmed,
  isReservationIncomePending,
} from "@/lib/finance/reservation-income-status";
import {
  buildFinanceYearlySeries,
  FINANCE_YEAR_MONTH_LABELS,
  type FinanceYearMonthPoint,
} from "@/services/finance/finance-yearly-series";
import type { Locale } from "@/i18n/types";

export type FinanceKpis = {
  revenue: number;
  revenueFormatted: string;
  expenses: number;
  expensesFormatted: string;
  netProfit: number;
  netProfitFormatted: string;
  pendingIncome: number;
  pendingIncomeFormatted: string;
  outstanding: number;
  outstandingFormatted: string;
  reservationRevenue: number;
  manualIncomeTotal: number;
  reservationExpenses: number;
  manualExpenseTotal: number;
};

export type MonthComparison = {
  revenue: { current: number; previous: number; trend: number };
  expenses: { current: number; previous: number; trend: number };
  profit: { current: number; previous: number; trend: number };
  occupancy: { current: number; previous: number; trend: number };
  reservations: { current: number; previous: number; trend: number };
};

export type RevenueFlowRow = {
  id: string;
  source: string;
  guestName?: string;
  amount: number;
  amountFormatted: string;
  date: string;
  propertyName: string;
  status: "confirmed" | "pending";
};

export type ExpenseFlowRow = {
  id: string;
  category: string;
  amount: number;
  amountFormatted: string;
  date: string;
  propertyName: string;
  responsible: string;
  detail?: string;
};

const ACCOUNTING_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
];

export type TopPropertyRow = {
  propertyId: string;
  name: string;
  revenue: number;
  revenueFormatted: string;
  occupancy: number;
  reservations: number;
};

export type FinanceOverview = {
  selectedMonth: string;
  selectedMonthLabel: string;
  kpis: FinanceKpis;
  comparison: MonthComparison;
  /** Solo ingresos reales acumulados del año (sin proyección de pendientes). */
  yearToDateRevenue: number;
  yearToDateRevenueFormatted: string;
  chartYear: number;
  yearlyChart: FinanceYearMonthPoint[];
  revenueFlow: RevenueFlowRow[];
  expenseFlow: ExpenseFlowRow[];
  profitability: {
    margin: number;
    roi: number;
    avgPerProperty: number;
    avgPerReservation: number;
  };
  topProperties: TopPropertyRow[];
};

function monthBounds(reference = new Date()) {
  return monthBoundsInTimezone(reference);
}

function parseFinanceMonthReference(monthKey?: string): Date {
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const [year, month] = monthKey.split("-").map(Number);
    if (month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 15, 12, 0, 0, 0));
    }
  }
  return todayPrismaDate();
}

function trendPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function sortByDateDesc<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

async function loadEnrichmentByReservationId(
  reservationIds: string[],
) {
  return loadReservationRevenueSourcesByReservationId(reservationIds);
}

function revenueForReservation(
  reservation: { id: string; totalAmount: unknown },
  revenueSourcesByReservationId: Awaited<
    ReturnType<typeof loadReservationRevenueSourcesByReservationId>
  >,
): number {
  const sources = revenueSourcesByReservationId.get(reservation.id);
  return resolveReservationRevenueAmount({
    totalAmount: reservation.totalAmount,
    enrichedFields: sources?.enrichedFields,
    payloadSignals: sources?.payloadSignals,
    emailMatchBlob: sources?.emailMatchBlob,
    payoutNet: sources?.payoutNet,
  });
}

export async function getFinanceOverview(
  locale: Locale = "es",
  options?: { month?: string },
): Promise<FinanceOverview> {
  const scope = await requireTenantDataScope();
  const reference = parseFinanceMonthReference(options?.month);
  const { start, end, prevStart, prevEnd, year, month } = monthBounds(reference);
  const selectedMonth = `${year}-${String(month).padStart(2, "0")}`;
  const selectedMonthLabel = `${FINANCE_YEAR_MONTH_LABELS[month - 1]} ${year}`;
  const today = todayPrismaDate();

  const [
    currentReservations,
    previousReservations,
    activeProperties,
    currentManual,
    previousManual,
  ] = await Promise.all([
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: { in: ACCOUNTING_RESERVATION_STATUSES },
          checkIn: { lte: end },
          checkOut: { gte: start },
        }),
      ),
      select: {
        id: true,
        guestName: true,
        totalAmount: true,
        paymentStatus: true,
        checkIn: true,
        platform: true,
        property: {
          select: {
            id: true,
            name: true,
            unitNumber: true,
            cleaningFee: true,
          },
        },
      },
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: { in: ACCOUNTING_RESERVATION_STATUSES },
          checkIn: { lte: prevEnd },
          checkOut: { gte: prevStart },
        }),
      ),
      select: {
        id: true,
        totalAmount: true,
        paymentStatus: true,
        checkIn: true,
        property: { select: { cleaningFee: true } },
      },
    }),
    db.property.count({
      where: mergePropertyScope(scope, { status: PropertyStatus.ACTIVE }),
    }),
    getManualFinanceInRange(start, end, scope),
    getManualFinanceInRange(prevStart, prevEnd, scope),
  ]);

  const { expenses: manualExpenses, incomes: manualIncomes } = currentManual;
  const manualExpenseTotal = currentManual.expenseTotal;
  const manualIncomeTotal = currentManual.incomeTotal;

  const enrichmentByReservationId = await loadEnrichmentByReservationId([
    ...new Set([
      ...currentReservations.map((r) => r.id),
      ...previousReservations.map((r) => r.id),
    ]),
  ]);

  const paidReservations = currentReservations.filter((r) =>
    isReservationIncomeConfirmed(r.checkIn, r.paymentStatus, today),
  );
  const pendingReservations = currentReservations.filter((r) =>
    isReservationIncomePending(r.checkIn, r.paymentStatus, today),
  );
  const prevPaidReservations = previousReservations.filter((r) =>
    isReservationIncomeConfirmed(r.checkIn, r.paymentStatus, today),
  );

  const reservationRevenue = paidReservations.reduce(
    (sum, r) => sum + revenueForReservation(r, enrichmentByReservationId),
    0,
  );
  const prevReservationRevenue = prevPaidReservations.reduce(
    (sum, r) => sum + revenueForReservation(r, enrichmentByReservationId),
    0,
  );
  const pendingIncome = pendingReservations.reduce(
    (sum, r) => sum + revenueForReservation(r, enrichmentByReservationId),
    0,
  );

  const revenue = reservationRevenue + manualIncomeTotal;
  const prevRevenue = prevReservationRevenue + previousManual.incomeTotal;

  const expenses = manualExpenseTotal;
  const prevExpenses = previousManual.expenseTotal;

  const netProfit = revenue - expenses;
  const prevProfit = prevRevenue - prevExpenses;
  const reservationExpenses = 0;

  const revenueFlow: RevenueFlowRow[] = sortByDateDesc([
    ...currentReservations.map((r) => {
      const amount = revenueForReservation(r, enrichmentByReservationId);
      return {
        id: r.id,
        source: r.platform,
        guestName: r.guestName,
        amount,
        amountFormatted: formatMoney(amount, undefined, locale),
        date: prismaDateToKey(r.checkIn),
        propertyName: formatPropertyLabel(r.property),
        status: isReservationIncomePending(r.checkIn, r.paymentStatus, today)
          ? ("pending" as const)
          : ("confirmed" as const),
      };
    }),
    ...manualIncomes.map((row) => ({
      id: row.id,
      source: row.description ?? row.incomeType,
      amount: Number(row.amount),
      amountFormatted: formatMoney(Number(row.amount), undefined, locale),
      date: row.incomeDate.toISOString(),
      propertyName: "Otros ingresos",
      status: "confirmed" as const,
    })),
  ]);

  const expenseFlow: ExpenseFlowRow[] = sortByDateDesc([
    ...manualExpenses.map((row) => ({
      id: row.id,
      category: row.category,
      amount: Number(row.amount),
      amountFormatted: formatMoney(Number(row.amount), undefined, locale),
      date: row.expenseDate.toISOString(),
      propertyName: "Otros egresos",
      responsible: "Finanzas",
      detail:
        "description" in row && row.description
          ? String(row.description)
          : undefined,
    })),
  ]);

  const byProperty = new Map<
    string,
    { name: string; revenue: number; count: number }
  >();
  for (const r of paidReservations) {
    const existing = byProperty.get(r.property.id) ?? {
      name: formatPropertyLabel(r.property),
      revenue: 0,
      count: 0,
    };
    existing.revenue += revenueForReservation(r, enrichmentByReservationId);
    existing.count += 1;
    byProperty.set(r.property.id, existing);
  }

  const topProperties: TopPropertyRow[] = [...byProperty.entries()]
    .map(([propertyId, data]) => ({
      propertyId,
      name: data.name,
      revenue: data.revenue,
      revenueFormatted: formatMoney(data.revenue, undefined, locale),
      occupancy: clampPercent(
        activeProperties > 0 ? (data.count / activeProperties) * 100 : 0,
      ),
      reservations: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  if (manualIncomeTotal > 0) {
    topProperties.push({
      propertyId: "manual-income",
      name: "Otros ingresos",
      revenue: manualIncomeTotal,
      revenueFormatted: formatMoney(manualIncomeTotal, undefined, locale),
      occupancy: 0,
      reservations: manualIncomes.length,
    });
    topProperties.sort((a, b) => b.revenue - a.revenue);
  }

  const incomeEventCount = paidReservations.length + manualIncomes.length;
  const avgPerProperty =
    activeProperties > 0 ? Math.round(revenue / activeProperties) : 0;
  const avgPerReservation =
    incomeEventCount > 0 ? Math.round(revenue / incomeEventCount) : 0;
  const margin = revenue > 0 ? clampPercent((netProfit / revenue) * 100) : 0;
  const roi = expenses > 0 ? clampPercent((netProfit / expenses) * 100) : 0;

  const chartYear = year;
  const yearlyChart = await buildFinanceYearlySeries(scope, chartYear);
  const yearToDateRevenue = yearlyChart
    .filter((m) => !m.isFuture)
    .reduce((sum, m) => sum + m.revenue, 0);

  return {
    selectedMonth,
    selectedMonthLabel,
    kpis: {
      revenue,
      revenueFormatted: formatMoney(revenue, undefined, locale),
      expenses,
      expensesFormatted: formatMoney(expenses, undefined, locale),
      netProfit,
      netProfitFormatted: formatMoney(netProfit, undefined, locale),
      pendingIncome,
      pendingIncomeFormatted: formatMoney(pendingIncome, undefined, locale),
      outstanding: pendingIncome,
      outstandingFormatted: formatMoney(pendingIncome, undefined, locale),
      reservationRevenue,
      manualIncomeTotal,
      reservationExpenses,
      manualExpenseTotal,
    },
    comparison: {
      revenue: {
        current: revenue,
        previous: prevRevenue,
        trend: trendPct(revenue, prevRevenue),
      },
      expenses: {
        current: expenses,
        previous: prevExpenses,
        trend: trendPct(expenses, prevExpenses),
      },
      profit: {
        current: netProfit,
        previous: prevProfit,
        trend: trendPct(netProfit, prevProfit),
      },
      occupancy: {
        current: 0,
        previous: 0,
        trend: 0,
      },
      reservations: {
        current: paidReservations.length,
        previous: prevPaidReservations.length,
        trend: trendPct(
          paidReservations.length,
          prevPaidReservations.length,
        ),
      },
    },
    yearToDateRevenue,
    yearToDateRevenueFormatted: formatMoney(yearToDateRevenue, undefined, locale),
    chartYear,
    yearlyChart,
    revenueFlow,
    expenseFlow,
    profitability: {
      margin,
      roi,
      avgPerProperty,
      avgPerReservation,
    },
    topProperties: topProperties.slice(0, 5),
  };
}
