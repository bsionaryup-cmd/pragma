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
import { sumConfirmedReservationRevenue } from "@/lib/finance/confirmed-reservation-revenue";
import { todayPrismaDate } from "@/lib/dates";
import { formatPropertyLabel } from "@/lib/property-display";
import { addCalendarDaysToKey, dateKeyToPrismaDate, todayDateKeyInTimezone } from "@/lib/dates";
import { startOfDay } from "@/lib/helpers/date";
import { monthBoundsInTimezone } from "@/lib/timezone";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  mergePropertyScope,
  mergeReservationScope,
  taskWhere,
  ttLockIntegrationWhere,
  type TenantDataScope,
} from "@/lib/platform/tenant-data-scope";
import type { Locale } from "@/i18n/types";
import {
  getCurrentStays,
  getPanelCounts,
  getTodayArrivals,
  getTodayDepartures,
  getTodayPanelCounts,
  getUpcomingArrivals,
  getUpcomingDepartures,
  toPanelReservationRow,
  sortPanelRowsByCheckIn,
  sortPanelRowsByCheckOut,
  type PanelReservationRow,
  type TodayPanelCounts,
} from "@/services/dashboard/dashboard.service";
import { getManualFinanceInRange } from "@/services/finance/finance-manual-totals";
import { loadReservationRevenueSourcesByReservationId } from "@/services/finance/reservation-revenue-context.service";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";
import { getAirbnbEnrichedGuestNameByReservationIds } from "@/services/reservations/airbnb-display-guest-name.service";

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
  type: "lock" | "payment" | "cleaning" | "sync" | "conflict" | "registration";
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
  todayArrivals: PanelReservationRow[];
  todayDepartures: PanelReservationRow[];
  todayCounts: TodayPanelCounts;
  counts: Awaited<ReturnType<typeof getPanelCounts>>;
  totalPropertyCount: number;
};

function monthBounds(reference = new Date()) {
  return monthBoundsInTimezone(reference);
}

const ACCOUNTING_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
];

const financeRevenueReservationSelect = {
  id: true,
  totalAmount: true,
  platform: true,
  icalUid: true,
  reservationCode: true,
  checkIn: true,
  paymentStatus: true,
} as const;

async function sumFinanceAlignedReservationRevenue(
  reservations: Array<{
    id: string;
    totalAmount: { toString(): string } | unknown;
    platform: import("@prisma/client").BookingPlatform;
    icalUid: string | null;
    reservationCode: string | null;
    checkIn: Date;
    paymentStatus: import("@prisma/client").PaymentStatus;
  }>,
  today: Date,
): Promise<number> {
  if (reservations.length === 0) return 0;
  const revenueSourcesByReservationId = await loadReservationRevenueSourcesByReservationId(
    reservations.map((reservation) => reservation.id),
  );
  return sumConfirmedReservationRevenue(
    reservations,
    revenueSourcesByReservationId,
    today,
  );
}

function computeOccupancyFromReservations(
  reservations: { checkIn: Date; checkOut: Date }[],
  activeProperties: number,
  daysInMonth: number,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  if (activeProperties <= 0 || daysInMonth <= 0) return 0;

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
  const scope = await requireTenantDataScope();
  const today = startOfDay();
  const registrationDueBy = dateKeyToPrismaDate(
    addCalendarDaysToKey(todayDateKeyInTimezone(), 2),
  );
  const { start, end, prevStart, prevEnd, daysInMonth } = monthBounds();
  const financeToday = todayPrismaDate();

  const [
    activeProperties,
    totalPropertyCount,
    checkedInReservations,
    counts,
    arrivalsRaw,
    departuresRaw,
    currentRaw,
    todayArrivalsRaw,
    todayDeparturesRaw,
    todayCounts,
    pendingCleaning,
    propertiesWithStaleSync,
    pendingGuestRegistration,
    ttlockConnected,
    monthReservations,
    prevMonthReservations,
    currentMonthRevenueReservations,
    previousMonthRevenueReservations,
    recentReservations,
    recentTasks,
    portfolioCapacity,
  ] = await Promise.all([
    db.property.count({
      where: mergePropertyScope(scope, { status: PropertyStatus.ACTIVE }),
    }),
    db.property.count({
      where: mergePropertyScope(scope, {}),
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: ReservationStatus.CHECKED_IN,
        }),
      ),
      select: {
        propertyId: true,
        adults: true,
        children: true,
        infants: true,
        property: { select: { maxGuests: true } },
      },
    }),
    getPanelCounts(scope),
    getUpcomingArrivals(scope, 8),
    getUpcomingDepartures(scope, 8),
    getCurrentStays(scope, 8),
    getTodayArrivals(scope, 8),
    getTodayDepartures(scope, 8),
    getTodayPanelCounts(scope),
    db.task.count({
      where: {
        ...taskWhere(scope),
        type: TaskType.CLEANING,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
    }),
    db.property.count({
      where: mergePropertyScope(scope, {
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
      }),
    }),
    db.tTLockIntegration.count({
      where: {
        ...ttLockIntegrationWhere(scope),
        status: {
          in: [TTLockIntegrationStatus.CONNECTED, TTLockIntegrationStatus.READY],
        },
      },
    }),
    db.reservation.count({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          guestRegistrationCompletedAt: null,
          status: {
            in: [
              ReservationStatus.CONFIRMED,
              ReservationStatus.CHECKED_IN,
              ReservationStatus.CHECKOUT_TODAY,
            ],
          },
          checkIn: { gte: today, lte: registrationDueBy },
        }),
      ),
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
          },
          checkIn: { lte: end },
          checkOut: { gte: start },
        }),
      ),
      select: {
        totalAmount: true,
        checkIn: true,
        checkOut: true,
        property: { select: { cleaningFee: true } },
      },
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
          },
          checkIn: { lte: prevEnd },
          checkOut: { gte: prevStart },
        }),
      ),
      select: {
        totalAmount: true,
        checkIn: true,
        checkOut: true,
        property: { select: { cleaningFee: true } },
      },
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: { in: ACCOUNTING_RESERVATION_STATUSES },
          checkIn: { gte: start, lte: end },
        }),
      ),
      select: financeRevenueReservationSelect,
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: { in: ACCOUNTING_RESERVATION_STATUSES },
          checkIn: { gte: prevStart, lte: prevEnd },
        }),
      ),
      select: financeRevenueReservationSelect,
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {}),
      ),
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        guestName: true,
        platform: true,
        guestRegistrationCompletedAt: true,
        createdAt: true,
        property: { select: { name: true, unitNumber: true } },
      },
    }),
    db.task.findMany({
      where: {
        ...taskWhere(scope),
        status: TaskStatus.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        completedAt: true,
        property: { select: { name: true, unitNumber: true } },
      },
    }),
    db.property.aggregate({
      where: mergePropertyScope(scope, { status: PropertyStatus.ACTIVE }),
      _sum: { maxGuests: true },
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
  const guestsCapacity =
    guestsCurrent > 0
      ? checkedInCapacity
      : (portfolioCapacity._sum.maxGuests ?? 0);

  const occupiedProperties = new Set(
    checkedInReservations.map((r) => r.propertyId),
  ).size;

  const occupancyCurrent =
    activeProperties > 0
      ? clampPercent((occupiedProperties / activeProperties) * 100)
      : 0;

  const occupancyMonthly = computeOccupancyFromReservations(
    monthReservations,
    activeProperties,
    daysInMonth,
    start,
    end,
  );
  const occupancyMonthlyPrev = computeOccupancyFromReservations(
    prevMonthReservations,
    activeProperties,
    daysInMonth,
    prevStart,
    prevEnd,
  );

  const [currentManual, previousManual] = await Promise.all([
    getManualFinanceInRange(start, end, scope),
    getManualFinanceInRange(prevStart, prevEnd, scope),
  ]);

  const [currentReservationRevenue, previousReservationRevenue] = await Promise.all([
    sumFinanceAlignedReservationRevenue(currentMonthRevenueReservations, financeToday),
    sumFinanceAlignedReservationRevenue(previousMonthRevenueReservations, financeToday),
  ]);

  const monthlyRevenue = currentReservationRevenue + currentManual.incomeTotal;
  const prevMonthlyRevenue = previousReservationRevenue + previousManual.incomeTotal;
  const revenueTrend =
    prevMonthlyRevenue > 0
      ? Math.round(((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100)
      : 0;

  const monthlyExpenses = currentManual.expenseTotal;
  const prevMonthlyExpenses = previousManual.expenseTotal;
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
  if (pendingGuestRegistration > 0) {
    alerts.push({
      id: "guest-registration",
      type: "registration",
      severity: "warning",
      messageKey: "dashboard.alerts.guestRegistrationDue",
    });
  }

  const activityGuestByReservation = await getAirbnbEnrichedGuestNameByReservationIds(
    recentReservations.map((reservation) => reservation.id),
  );
  const activity: ActivityItem[] = [
    ...recentReservations.map((r) => ({
      id: `res-${r.id}`,
      type: "reservation" as const,
      title: resolveReservationDisplayGuestName({
        platform: r.platform,
        airbnbEnrichmentGuestName: activityGuestByReservation.get(r.id) ?? null,
        guestName: r.guestName,
        guestRegistrationCompletedAt: r.guestRegistrationCompletedAt,
      }),
      subtitle: formatPropertyLabel(r.property),
      at: r.createdAt.toISOString(),
    })),
    ...recentTasks
      .filter((t) => t.completedAt)
      .map((t) => ({
        id: `task-${t.id}`,
        type: "task" as const,
        title: t.title,
        subtitle: t.property ? formatPropertyLabel(t.property) : "—",
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
    arrivals: sortPanelRowsByCheckIn(arrivalsRaw.map(toPanelReservationRow)),
    departures: sortPanelRowsByCheckOut(departuresRaw.map(toPanelReservationRow)),
    currentStays: sortPanelRowsByCheckIn(currentRaw.map(toPanelReservationRow)),
    todayArrivals: sortPanelRowsByCheckIn(todayArrivalsRaw.map(toPanelReservationRow)),
    todayDepartures: sortPanelRowsByCheckOut(todayDeparturesRaw.map(toPanelReservationRow)),
    todayCounts,
    counts,
    totalPropertyCount,
  };
}
