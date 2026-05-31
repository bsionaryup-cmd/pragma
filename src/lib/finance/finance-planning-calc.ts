import { clampPercent } from "@/lib/format-currency";
import type {
  FinancePlanningSettingsInput,
  FinancePlanningSnapshot,
  FinancePlanningVariableExpense,
} from "@/lib/finance/finance-planning-types";

export type FinancePlanningCalcInput = {
  settings: FinancePlanningSettingsInput;
  currentRevenue: number;
  currentOccupancyPct: number;
  occupiedNights: number;
  availableNights: number;
  bookingCount: number;
  formatAmount: (amount: number) => string;
};

function sumFixedCosts(settings: FinancePlanningSettingsInput): number {
  return settings.fixedExpenses.reduce(
    (sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0),
    0,
  );
}

function sumPercentRates(variableExpenses: FinancePlanningVariableExpense[]): number {
  return variableExpenses
    .filter((row) => row.type === "percent")
    .reduce((sum, row) => sum + (Number.isFinite(row.value) ? row.value : 0), 0);
}

function sumFixedPerBookingCosts(
  variableExpenses: FinancePlanningVariableExpense[],
  bookingCount: number,
): number {
  return variableExpenses
    .filter((row) => row.type === "fixed_per_booking")
    .reduce(
      (sum, row) =>
        sum +
        (Number.isFinite(row.value) ? row.value : 0) * Math.max(0, bookingCount),
      0,
    );
}

function estimateVariableCostAtRevenue(
  revenue: number,
  variableExpenses: FinancePlanningVariableExpense[],
  bookingCount: number,
): number {
  const percentTotal = variableExpenses
    .filter((row) => row.type === "percent")
    .reduce(
      (sum, row) =>
        sum + revenue * ((Number.isFinite(row.value) ? row.value : 0) / 100),
      0,
    );

  return Math.round(percentTotal + sumFixedPerBookingCosts(variableExpenses, bookingCount));
}

function resolveEstimatedAdr(input: {
  currentRevenue: number;
  occupiedNights: number;
  availableNights: number;
}): number {
  if (input.occupiedNights > 0 && input.currentRevenue > 0) {
    return Math.round(input.currentRevenue / input.occupiedNights);
  }

  if (input.availableNights > 0 && input.currentRevenue > 0) {
    return Math.round(input.currentRevenue / input.availableNights);
  }

  return 0;
}

export function computeFinancePlanningSnapshot(
  input: FinancePlanningCalcInput,
): FinancePlanningSnapshot {
  const totalFixedCost = Math.round(sumFixedCosts(input.settings));
  const profitGoal = Math.round(
    Number.isFinite(input.settings.monthlyProfitGoal)
      ? input.settings.monthlyProfitGoal
      : 0,
  );
  const bookingCount = Math.max(0, input.bookingCount);
  const bookingVariableCost = sumFixedPerBookingCosts(
    input.settings.variableExpenses,
    bookingCount,
  );
  const percentRate = sumPercentRates(input.settings.variableExpenses);

  let requiredRevenue = totalFixedCost + profitGoal + bookingVariableCost;
  if (percentRate > 0 && percentRate < 100) {
    requiredRevenue = Math.round(
      (totalFixedCost + profitGoal + bookingVariableCost) / (1 - percentRate / 100),
    );
  } else if (percentRate >= 100) {
    requiredRevenue = Math.round(
      totalFixedCost + profitGoal + bookingVariableCost + input.currentRevenue,
    );
  }

  const totalVariableCost = estimateVariableCostAtRevenue(
    requiredRevenue,
    input.settings.variableExpenses,
    bookingCount,
  );

  const estimatedAdr = resolveEstimatedAdr({
    currentRevenue: input.currentRevenue,
    occupiedNights: input.occupiedNights,
    availableNights: input.availableNights,
  });
  const expectedMonthCapacity = Math.round(
    Math.max(0, input.availableNights) * estimatedAdr,
  );
  const requiredOccupancyPct =
    expectedMonthCapacity > 0
      ? clampPercent((requiredRevenue / expectedMonthCapacity) * 100)
      : 0;
  const remainingToGoal = Math.max(0, requiredRevenue - input.currentRevenue);
  const hasConfiguration =
    totalFixedCost > 0 ||
    profitGoal > 0 ||
    input.settings.variableExpenses.length > 0 ||
    input.settings.fixedExpenses.length > 0;

  return {
    monthlyProfitGoal: profitGoal,
    monthlyProfitGoalFormatted: input.formatAmount(profitGoal),
    totalFixedCost,
    totalFixedCostFormatted: input.formatAmount(totalFixedCost),
    totalVariableCost,
    totalVariableCostFormatted: input.formatAmount(totalVariableCost),
    requiredRevenue,
    requiredRevenueFormatted: input.formatAmount(requiredRevenue),
    requiredOccupancyPct,
    currentOccupancyPct: input.currentOccupancyPct,
    currentRevenue: input.currentRevenue,
    currentRevenueFormatted: input.formatAmount(input.currentRevenue),
    remainingToGoal,
    remainingToGoalFormatted: input.formatAmount(remainingToGoal),
    estimatedAdr,
    estimatedAdrFormatted: input.formatAmount(estimatedAdr),
    expectedMonthCapacity,
    expectedMonthCapacityFormatted: input.formatAmount(expectedMonthCapacity),
    settings: input.settings,
    repeatedExpenseHints: [],
    hasConfiguration,
  };
}
