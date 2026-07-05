import { clampPercent } from "@/lib/format-currency";
import type { MonthlyFinanceAggregate } from "@/lib/finance/monthly-finance-calc";
import { aggregateMonthlyFinanceMetrics } from "@/lib/finance/monthly-finance-calc";
import type { MonthlyFinancePropertyMetric } from "@/lib/finance/monthly-finance-calc";

/** Single source of truth for portfolio/property occupancy percentage. */
export function calculateOccupancy(input: {
  occupiedNights: number;
  availableNights: number;
}): number {
  if (input.availableNights <= 0) return 0;
  return clampPercent((input.occupiedNights / input.availableNights) * 100);
}

export function calculateOccupancyFromPropertyMetrics(
  rows: MonthlyFinancePropertyMetric[],
): number {
  return aggregateMonthlyFinanceMetrics(rows).occupancyPct;
}

export function occupancyPctFromAggregate(
  aggregate: MonthlyFinanceAggregate | null | undefined,
): number {
  if (!aggregate) return 0;
  return calculateOccupancy({
    occupiedNights: aggregate.occupiedNights,
    availableNights: aggregate.availableNights,
  });
}
