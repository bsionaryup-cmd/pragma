import { PropertyStatus, ReservationStatus, PaymentStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { clampPercent, formatMoney } from "@/lib/format-currency";
import { formatPropertyLabel } from "@/lib/property-display";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  mergePropertyScope,
  mergeReservationScope,
} from "@/lib/platform/tenant-data-scope";
import { getManualFinanceInRange } from "@/services/finance/finance-manual-totals";
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

const PAID_STATUSES: PaymentStatus[] = [PaymentStatus.PAID];
const PENDING_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.PARTIAL,
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
  kpis: FinanceKpis;
  comparison: MonthComparison;
  revenueForecast: number;
  revenueForecastFormatted: string;
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
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  const prevStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const prevEnd = new Date(reference.getFullYear(), reference.getMonth(), 0);
  prevStart.setHours(0, 0, 0, 0);
  prevEnd.setHours(23, 59, 59, 999);
  return { start, end, prevStart, prevEnd };
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

export async function getFinanceOverview(locale: Locale = "es"): Promise<FinanceOverview> {
  const scope = await requireTenantDataScope();
  const { start, end, prevStart, prevEnd } = monthBounds();

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
        totalAmount: true,
        paymentStatus: true,
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

  const paidReservations = currentReservations.filter((r) =>
    PAID_STATUSES.includes(r.paymentStatus),
  );
  const pendingReservations = currentReservations.filter((r) =>
    PENDING_PAYMENT_STATUSES.includes(r.paymentStatus),
  );
  const prevPaidReservations = previousReservations.filter((r) =>
    PAID_STATUSES.includes(r.paymentStatus),
  );

  const reservationRevenue = paidReservations.reduce(
    (sum, r) => sum + Number(r.totalAmount),
    0,
  );
  const prevReservationRevenue = prevPaidReservations.reduce(
    (sum, r) => sum + Number(r.totalAmount),
    0,
  );
  const pendingIncome = pendingReservations.reduce(
    (sum, r) => sum + Number(r.totalAmount),
    0,
  );

  const reservationExpenses = currentReservations.reduce((sum, r) => {
    const fee = r.property.cleaningFee ? Number(r.property.cleaningFee) : 0;
    return sum + fee;
  }, 0);
  const prevReservationExpenses = previousReservations.reduce((sum, r) => {
    const fee = r.property.cleaningFee ? Number(r.property.cleaningFee) : 0;
    return sum + fee;
  }, 0);

  const revenue = reservationRevenue + manualIncomeTotal;
  const prevRevenue = prevReservationRevenue + previousManual.incomeTotal;

  const expenses = reservationExpenses + manualExpenseTotal;
  const prevExpenses = prevReservationExpenses + previousManual.expenseTotal;

  const netProfit = revenue - expenses;
  const prevProfit = prevRevenue - prevExpenses;

  const revenueFlow: RevenueFlowRow[] = sortByDateDesc([
    ...currentReservations.map((r) => ({
      id: r.id,
      source: r.platform,
      guestName: r.guestName,
      amount: Number(r.totalAmount),
      amountFormatted: formatMoney(Number(r.totalAmount), undefined, locale),
      date: r.checkIn.toISOString(),
      propertyName: formatPropertyLabel(r.property),
      status: PAID_STATUSES.includes(r.paymentStatus)
        ? ("confirmed" as const)
        : ("pending" as const),
    })),
    ...manualIncomes.map((row) => ({
      id: row.id,
      source: row.incomeType,
      amount: Number(row.amount),
      amountFormatted: formatMoney(Number(row.amount), undefined, locale),
      date: row.incomeDate.toISOString(),
      propertyName: "Otros ingresos",
      status: "confirmed" as const,
    })),
  ]);

  const expenseFlow: ExpenseFlowRow[] = sortByDateDesc([
    ...currentReservations
      .filter((r) => r.property.cleaningFee)
      .map((r) => ({
        id: `exp-${r.id}`,
        category: "Limpieza",
        amount: Number(r.property.cleaningFee),
        amountFormatted: formatMoney(
          Number(r.property.cleaningFee),
          undefined,
          locale,
        ),
        date: r.checkIn.toISOString(),
        propertyName: formatPropertyLabel(r.property),
        responsible: "Reserva",
        detail: r.guestName,
      })),
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
    existing.revenue += Number(r.totalAmount);
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

  const forecast = Math.round(revenue + pendingIncome);

  return {
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
    revenueForecast: forecast,
    revenueForecastFormatted: formatMoney(forecast, undefined, locale),
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
