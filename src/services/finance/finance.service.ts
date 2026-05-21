import { PropertyStatus, ReservationStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { clampPercent, formatMoney } from "@/lib/format-currency";
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
};

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

export async function getFinanceOverview(locale: Locale = "es"): Promise<FinanceOverview> {
  const { start, end, prevStart, prevEnd } = monthBounds();

  const [currentReservations, previousReservations, activeProperties] =
    await Promise.all([
      db.reservation.findMany({
        where: withVisibleReservationsFilter({
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
          },
          checkIn: { lte: end },
          checkOut: { gte: start },
        }),
        select: {
          id: true,
          totalAmount: true,
          checkIn: true,
          platform: true,
          property: {
            select: {
              id: true,
              name: true,
              cleaningFee: true,
            },
          },
        },
      }),
      db.reservation.findMany({
        where: withVisibleReservationsFilter({
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
          },
          checkIn: { lte: prevEnd },
          checkOut: { gte: prevStart },
        }),
        select: {
          totalAmount: true,
          property: { select: { cleaningFee: true } },
        },
      }),
      db.property.count({ where: { status: PropertyStatus.ACTIVE } }),
    ]);

  const revenue = currentReservations.reduce(
    (sum, r) => sum + Number(r.totalAmount),
    0,
  );
  const prevRevenue = previousReservations.reduce(
    (sum, r) => sum + Number(r.totalAmount),
    0,
  );

  const expenses = currentReservations.reduce((sum, r) => {
    const fee = r.property.cleaningFee ? Number(r.property.cleaningFee) : 0;
    return sum + fee;
  }, 0);
  const prevExpenses = previousReservations.reduce((sum, r) => {
    const fee = r.property.cleaningFee ? Number(r.property.cleaningFee) : 0;
    return sum + fee;
  }, 0);

  const netProfit = revenue - expenses;
  const prevProfit = prevRevenue - prevExpenses;

  const pendingReservations = await db.reservation.count({
    where: withVisibleReservationsFilter({
      status: ReservationStatus.CONFIRMED,
      checkIn: { gt: end },
    }),
  });

  const pendingIncome = await db.reservation.aggregate({
    where: withVisibleReservationsFilter({
      status: ReservationStatus.CONFIRMED,
      checkIn: { gt: end },
    }),
    _sum: { totalAmount: true },
  });

  const revenueFlow: RevenueFlowRow[] = currentReservations
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      source: r.platform,
      amount: Number(r.totalAmount),
      amountFormatted: formatMoney(Number(r.totalAmount), undefined, locale),
      date: r.checkIn.toISOString(),
      propertyName: r.property.name,
      status: "confirmed" as const,
    }));

  const expenseFlow: ExpenseFlowRow[] = currentReservations
    .filter((r) => r.property.cleaningFee)
    .slice(0, 12)
    .map((r) => ({
      id: `exp-${r.id}`,
      category: "Limpieza",
      amount: Number(r.property.cleaningFee),
      amountFormatted: formatMoney(Number(r.property.cleaningFee), undefined, locale),
      date: r.checkIn.toISOString(),
      propertyName: r.property.name,
      responsible: "Operaciones",
    }));

  const byProperty = new Map<
    string,
    { name: string; revenue: number; count: number }
  >();
  for (const r of currentReservations) {
    const existing = byProperty.get(r.property.id) ?? {
      name: r.property.name,
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
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const avgPerProperty =
    activeProperties > 0 ? Math.round(revenue / activeProperties) : 0;
  const avgPerReservation =
    currentReservations.length > 0
      ? Math.round(revenue / currentReservations.length)
      : 0;
  const margin = revenue > 0 ? clampPercent((netProfit / revenue) * 100) : 0;
  const roi = expenses > 0 ? clampPercent((netProfit / expenses) * 100) : 0;

  const forecast = Math.round(revenue * 1.08 + pendingReservations * 0);

  const pendingSum = Number(pendingIncome._sum.totalAmount ?? 0);

  return {
    kpis: {
      revenue,
      revenueFormatted: formatMoney(revenue, undefined, locale),
      expenses,
      expensesFormatted: formatMoney(expenses, undefined, locale),
      netProfit,
      netProfitFormatted: formatMoney(netProfit, undefined, locale),
      pendingIncome: pendingSum,
      pendingIncomeFormatted: formatMoney(pendingSum, undefined, locale),
      outstanding: 0,
      outstandingFormatted: formatMoney(0, undefined, locale),
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
        current: currentReservations.length,
        previous: previousReservations.length,
        trend: trendPct(
          currentReservations.length,
          previousReservations.length,
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
    topProperties,
  };
}
