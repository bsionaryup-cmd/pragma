import { ReservationStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import {
  todayPrismaDate,
  toReservationDateKey,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { financeMonthBounds } from "@/lib/finance/finance-month-attribution";
import {
  aggregateMonthlyFinanceMetrics,
  computeMonthlyFinancePropertyMetric,
  type MonthlyFinanceAggregate,
} from "@/lib/finance/monthly-finance-calc";
import { parseMonthKey } from "@/lib/finance/monthly-finance-month-keys";
import {
  mergePropertyScope,
  mergeReservationScope,
  type TenantDataScope,
} from "@/lib/platform/tenant-data-scope";
import { loadReservationRevenueSourcesByReservationId } from "@/services/finance/reservation-revenue-context.service";

const RECALC_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
  ReservationStatus.BLOCKED,
];

function monthBoundsForKeys(monthKeys: string[]): { rangeStart: Date; rangeEnd: Date } {
  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;

  for (const monthKey of monthKeys) {
    const { year, month } = parseMonthKey(monthKey);
    const bounds = financeMonthBounds(year, month - 1);
    if (rangeStart === null || bounds.start.getTime() < rangeStart.getTime()) {
      rangeStart = bounds.start;
    }
    if (rangeEnd === null || bounds.end.getTime() > rangeEnd.getTime()) {
      rangeEnd = bounds.end;
    }
  }

  if (
    !rangeStart ||
    !rangeEnd ||
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime())
  ) {
    throw new Error("monthBoundsForKeys requires at least one valid month key");
  }

  return { rangeStart, rangeEnd };
}

export async function recalculateMonthlyFinanceMetrics(
  scope: TenantDataScope,
  monthKeys: string[],
): Promise<void> {
  if (!scope.organizationId || monthKeys.length === 0) return;

  const uniqueMonthKeys = [...new Set(monthKeys)];
  let rangeStart: Date;
  let rangeEnd: Date;
  try {
    ({ rangeStart, rangeEnd } = monthBoundsForKeys(uniqueMonthKeys));
  } catch (error) {
    console.error("[monthly-finance-metrics] invalid month keys", uniqueMonthKeys, error);
    return;
  }

  const today = todayPrismaDate();

  const [properties, reservations] = await Promise.all([
    db.property.findMany({
      where: mergePropertyScope(scope, {}),
      select: { id: true, status: true },
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: { in: RECALC_STATUSES },
          checkIn: { lte: rangeEnd },
          checkOut: { gt: rangeStart },
        }),
      ),
      select: {
        id: true,
        propertyId: true,
        status: true,
        checkIn: true,
        checkOut: true,
        totalAmount: true,
        paymentStatus: true,
      },
    }),
  ]);

  const revenueReservationIds = reservations
    .filter((reservation) => {
      const checkInKey = toReservationDateKey(reservation.checkIn);
      return uniqueMonthKeys.some((monthKey) => {
        const { year, month } = parseMonthKey(monthKey);
        const { startKey, endKey } = financeMonthBounds(year, month - 1);
        return checkInKey >= startKey && checkInKey <= endKey;
      });
    })
    .map((reservation) => reservation.id);

  const revenueSourcesByReservationId =
    await loadReservationRevenueSourcesByReservationId(revenueReservationIds);

  const upserts = uniqueMonthKeys.flatMap((monthKey) =>
    properties.map((property) => {
      const metric = computeMonthlyFinancePropertyMetric(
        property,
        monthKey,
        reservations,
        revenueSourcesByReservationId,
        today,
      );

      return db.monthlyFinanceMetric.upsert({
        where: {
          organizationId_propertyId_month: {
            organizationId: scope.organizationId!,
            propertyId: property.id,
            month: monthKey,
          },
        },
        create: {
          organizationId: scope.organizationId!,
          propertyId: property.id,
          month: monthKey,
          availableNights: metric.availableNights,
          occupiedNights: metric.occupiedNights,
          occupancyPct: metric.occupancyPct,
          grossRevenue: metric.grossRevenue,
          projectedRevenue: metric.projectedRevenue,
        },
        update: {
          availableNights: metric.availableNights,
          occupiedNights: metric.occupiedNights,
          occupancyPct: metric.occupancyPct,
          grossRevenue: metric.grossRevenue,
          projectedRevenue: metric.projectedRevenue,
        },
      });
    }),
  );

  if (upserts.length === 0) return;

  const chunkSize = 50;
  for (let index = 0; index < upserts.length; index += chunkSize) {
    await db.$transaction(upserts.slice(index, index + chunkSize));
  }
}

export async function ensureMonthlyFinanceMetrics(
  scope: TenantDataScope,
  monthKeys: string[],
): Promise<void> {
  if (!scope.organizationId || monthKeys.length === 0) return;

  const uniqueMonthKeys = [...new Set(monthKeys)];
  const existing = await db.monthlyFinanceMetric.findMany({
    where: {
      organizationId: scope.organizationId,
      month: { in: uniqueMonthKeys },
    },
    select: { month: true, propertyId: true },
  });

  const propertyCount = await db.property.count({
    where: mergePropertyScope(scope, {}),
  });

  if (propertyCount <= 0) return;

  const coveredCountByMonth = new Map<string, number>();
  for (const row of existing) {
    coveredCountByMonth.set(
      row.month,
      (coveredCountByMonth.get(row.month) ?? 0) + 1,
    );
  }

  const missingMonthKeys = uniqueMonthKeys.filter(
    (monthKey) => (coveredCountByMonth.get(monthKey) ?? 0) < propertyCount,
  );

  if (missingMonthKeys.length === 0) return;

  await recalculateMonthlyFinanceMetrics(scope, missingMonthKeys);
}

export async function loadMonthlyFinanceAggregates(
  scope: TenantDataScope,
  monthKeys: string[],
): Promise<Map<string, MonthlyFinanceAggregate>> {
  const aggregates = new Map<string, MonthlyFinanceAggregate>();
  if (!scope.organizationId || monthKeys.length === 0) return aggregates;

  const uniqueMonthKeys = [...new Set(monthKeys)];
  await ensureMonthlyFinanceMetrics(scope, uniqueMonthKeys);

  const rows = await db.monthlyFinanceMetric.findMany({
    where: {
      organizationId: scope.organizationId,
      month: { in: uniqueMonthKeys },
    },
    select: {
      month: true,
      availableNights: true,
      occupiedNights: true,
      grossRevenue: true,
      projectedRevenue: true,
    },
  });

  const grouped = new Map<string, ReturnType<typeof computeMonthlyFinancePropertyMetric>[]>();

  for (const row of rows) {
    const bucket = grouped.get(row.month) ?? [];
    bucket.push({
      propertyId: "",
      availableNights: row.availableNights,
      occupiedNights: row.occupiedNights,
      occupancyPct: 0,
      grossRevenue: Number(row.grossRevenue),
      projectedRevenue: Number(row.projectedRevenue),
    });
    grouped.set(row.month, bucket);
  }

  for (const monthKey of uniqueMonthKeys) {
    const propertyMetrics = grouped.get(monthKey) ?? [];
    aggregates.set(monthKey, aggregateMonthlyFinanceMetrics(propertyMetrics));
  }

  return aggregates;
}
