import {
  PropertyStatus,
  ReservationStatus,
  TaskStatus,
  TaskType,
  TTLockIntegrationStatus,
} from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { clampPercent, formatMoney } from "@/lib/format-currency";
import { startOfDay } from "@/lib/helpers/date";
import type { Locale } from "@/i18n/types";
import {
  getCurrentStays,
  getPanelCounts,
  getUpcomingArrivals,
  getUpcomingDepartures,
  toPanelReservationRow,
  type PanelReservationRow,
} from "@/services/dashboard/dashboard.service";

export type CommandCenterKpis = {
  occupancyCurrent: number;
  occupancyMonthly: number;
  occupancyTrend: number;
  monthlyRevenue: number;
  monthlyRevenueFormatted: string;
  revenueTrend: number;
  monthlyExpenses: number;
  monthlyExpensesFormatted: string;
  expenseTrend: number;
  netFlow: number;
  netFlowFormatted: string;
  netFlowTrend: number;
  criticalAlerts: number;
  automationActive: boolean;
};

export type CommandCenterTrendPoint = {
  label: string;
  revenue: number;
  expenses: number;
  net: number;
};

export type OperationalSummary = {
  upcomingCheckIns: number;
  upcomingCheckOuts: number;
  activeReservations: number;
  pendingCleaning: number;
  incidents: number;
  smartLockConfigured: boolean;
};

export type DashboardAlert = {
  id: string;
  type: "lock" | "payment" | "cleaning" | "sync" | "conflict";
  severity: "critical" | "warning";
  messageKey: string;
};

export type ActivityItem = {
  id: string;
  type: "reservation" | "checkIn" | "checkOut" | "task" | "sync";
  title: string;
  subtitle: string;
  at: string;
};

export type CommandCenterData = {
  kpis: CommandCenterKpis;
  trendPoints: CommandCenterTrendPoint[];
  operational: OperationalSummary;
  alerts: DashboardAlert[];
  activity: ActivityItem[];
  arrivals: PanelReservationRow[];
  departures: PanelReservationRow[];
  currentStays: PanelReservationRow[];
  counts: Awaited<ReturnType<typeof getPanelCounts>>;
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
  const daysInMonth = end.getDate();
  return { start, end, prevStart, prevEnd, daysInMonth };
}

function sumDecimal(rows: { totalAmount: { toString(): string } }[]): number {
  return rows.reduce((acc, row) => acc + Number(row.totalAmount), 0);
}

async function computeOccupancyMonthly(
  activeProperties: number,
  daysInMonth: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<number> {
  if (activeProperties <= 0 || daysInMonth <= 0) return 0;

  const reservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      status: {
        in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
      },
      checkIn: { lte: rangeEnd },
      checkOut: { gt: rangeStart },
    }),
    select: { checkIn: true, checkOut: true },
  });

  let occupiedNights = 0;
  for (const reservation of reservations) {
    const start = reservation.checkIn > rangeStart ? reservation.checkIn : rangeStart;
    const end = reservation.checkOut < rangeEnd ? reservation.checkOut : rangeEnd;
    const nights = Math.max(
      0,
      Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
    );
    occupiedNights += nights;
  }

  const capacity = activeProperties * daysInMonth;
  return clampPercent((occupiedNights / capacity) * 100);
}

export async function getCommandCenterData(locale: Locale = "es"): Promise<CommandCenterData> {
  const today = startOfDay();
  const { start, end, prevStart, prevEnd, daysInMonth } = monthBounds(today);

  const [
    activeProperties,
    checkedInReservations,
    activeReservationCount,
    counts,
    arrivalsRaw,
    departuresRaw,
    currentRaw,
    pendingCleaning,
    propertiesWithStaleSync,
    ttlockConnected,
    monthReservations,
    prevMonthReservations,
    recentReservations,
    recentTasks,
  ] = await Promise.all([
    db.property.count({ where: { status: PropertyStatus.ACTIVE } }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter({
        status: ReservationStatus.CHECKED_IN,
      }),
      select: {
        adults: true,
        children: true,
        infants: true,
        property: { select: { maxGuests: true } },
      },
    }),
    db.reservation.count({
      where: withVisibleReservationsFilter({
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
        },
      }),
    }),
    getPanelCounts(),
    getUpcomingArrivals(8),
    getUpcomingDepartures(8),
    getCurrentStays(8),
    db.task.count({
      where: {
        type: TaskType.CLEANING,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
    }),
    db.property.count({
      where: {
        status: PropertyStatus.ACTIVE,
        icalUrl: { not: null },
        OR: [
          { lastIcalSyncedAt: null },
          {
            lastIcalSyncedAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
    }),
    db.tTLockIntegration.count({
      where: {
        status: {
          in: [TTLockIntegrationStatus.CONNECTED, TTLockIntegrationStatus.READY],
        },
      },
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter({
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
        },
        checkIn: { lte: end },
        checkOut: { gte: start },
      }),
      select: {
        totalAmount: true,
        property: { select: { cleaningFee: true } },
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
    db.reservation.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        guestName: true,
        createdAt: true,
        property: { select: { name: true } },
      },
    }),
    db.task.findMany({
      where: { status: TaskStatus.COMPLETED },
      orderBy: { completedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        completedAt: true,
        property: { select: { name: true } },
      },
    }),
  ]);

  const guestsCurrent = checkedInReservations.reduce(
    (sum, r) => sum + r.adults + r.children + r.infants,
    0,
  );
  const checkedInCapacity = checkedInReservations.reduce(
    (sum, r) => sum + r.property.maxGuests,
    0,
  );
  const portfolioCapacity = await db.property.aggregate({
    where: { status: PropertyStatus.ACTIVE },
    _sum: { maxGuests: true },
  });
  const guestsCapacity =
    guestsCurrent > 0
      ? checkedInCapacity
      : (portfolioCapacity._sum.maxGuests ?? 0);

  const occupiedProperties = new Set(
    (
      await db.reservation.findMany({
        where: withVisibleReservationsFilter({
          status: ReservationStatus.CHECKED_IN,
        }),
        select: { propertyId: true },
      })
    ).map((r) => r.propertyId),
  ).size;

  const occupancyCurrent =
    activeProperties > 0
      ? clampPercent((occupiedProperties / activeProperties) * 100)
      : 0;

  const [occupancyMonthly, occupancyMonthlyPrev] = await Promise.all([
    computeOccupancyMonthly(activeProperties, daysInMonth, start, end),
    computeOccupancyMonthly(activeProperties, daysInMonth, prevStart, prevEnd),
  ]);

  const monthlyRevenue = sumDecimal(monthReservations);
  const prevMonthlyRevenue = sumDecimal(prevMonthReservations);
  const revenueTrend =
    prevMonthlyRevenue > 0
      ? Math.round(((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100)
      : 0;

  const monthlyExpenses = monthReservations.reduce(
    (sum, r) => sum + (r.property.cleaningFee ? Number(r.property.cleaningFee) : 0),
    0,
  );
  const prevMonthlyExpenses = prevMonthReservations.reduce(
    (sum, r) => sum + (r.property.cleaningFee ? Number(r.property.cleaningFee) : 0),
    0,
  );
  const expenseTrend =
    prevMonthlyExpenses > 0
      ? Math.round(((monthlyExpenses - prevMonthlyExpenses) / prevMonthlyExpenses) * 100)
      : 0;
  const netFlow = monthlyRevenue - monthlyExpenses;
  const prevNetFlow = prevMonthlyRevenue - prevMonthlyExpenses;
  const netFlowTrend =
    prevNetFlow !== 0
      ? Math.round(((netFlow - prevNetFlow) / Math.abs(prevNetFlow)) * 100)
      : 0;
  const occupancyTrend = occupancyMonthly - occupancyMonthlyPrev;

  const trendPoints: CommandCenterTrendPoint[] = [
    {
      label: "Mes ant.",
      revenue: prevMonthlyRevenue,
      expenses: prevMonthlyExpenses,
      net: prevNetFlow,
    },
    {
      label: "Actual",
      revenue: monthlyRevenue,
      expenses: monthlyExpenses,
      net: netFlow,
    },
  ];

  const alerts: DashboardAlert[] = [];
  if (pendingCleaning > 0) {
    alerts.push({
      id: "cleaning",
      type: "cleaning",
      severity: pendingCleaning > 3 ? "critical" : "warning",
      messageKey: "dashboard.alerts.cleaningDelayed",
    });
  }
  if (propertiesWithStaleSync > 0) {
    alerts.push({
      id: "sync",
      type: "sync",
      severity: "warning",
      messageKey: "dashboard.alerts.syncFailure",
    });
  }

  const activity: ActivityItem[] = [
    ...recentReservations.map((r) => ({
      id: `res-${r.id}`,
      type: "reservation" as const,
      title: r.guestName,
      subtitle: r.property.name,
      at: r.createdAt.toISOString(),
    })),
    ...recentTasks
      .filter((t) => t.completedAt)
      .map((t) => ({
        id: `task-${t.id}`,
        type: "task" as const,
        title: t.title,
        subtitle: t.property?.name ?? "—",
        at: t.completedAt!.toISOString(),
      })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return {
    kpis: {
      occupancyCurrent,
      occupancyMonthly,
      occupancyTrend,
      monthlyRevenue,
      monthlyRevenueFormatted: formatMoney(monthlyRevenue, undefined, locale),
      revenueTrend,
      monthlyExpenses,
      monthlyExpensesFormatted: formatMoney(monthlyExpenses, undefined, locale),
      expenseTrend,
      netFlow,
      netFlowFormatted: formatMoney(netFlow, undefined, locale),
      netFlowTrend,
      criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
      automationActive: ttlockConnected > 0,
    },
    trendPoints,
    operational: {
      upcomingCheckIns: counts.arrivals,
      upcomingCheckOuts: counts.departures,
      activeReservations: counts.current,
      pendingCleaning,
      incidents: 0,
      smartLockConfigured: ttlockConnected > 0,
    },
    alerts,
    activity,
    arrivals: arrivalsRaw.map(toPanelReservationRow),
    departures: departuresRaw.map(toPanelReservationRow),
    currentStays: currentRaw.map(toPanelReservationRow),
    counts,
  };
}
