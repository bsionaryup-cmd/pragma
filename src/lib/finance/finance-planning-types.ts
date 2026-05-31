export type FinancePlanningFixedExpense = {
  name: string;
  amount: number;
};

export type FinancePlanningVariableExpenseType = "percent" | "fixed_per_booking";

export type FinancePlanningVariableExpense = {
  name: string;
  type: FinancePlanningVariableExpenseType;
  value: number;
};

export type FinancePlanningSettingsInput = {
  fixedExpenses: FinancePlanningFixedExpense[];
  variableExpenses: FinancePlanningVariableExpense[];
  monthlyProfitGoal: number;
  propertyId?: string | null;
};

export type FinancePlanningRepeatedExpenseHint = {
  name: string;
  amount: number;
  occurrences: number;
};

export type FinancePlanningSnapshot = {
  monthlyProfitGoal: number;
  monthlyProfitGoalFormatted: string;
  totalFixedCost: number;
  totalFixedCostFormatted: string;
  totalVariableCost: number;
  totalVariableCostFormatted: string;
  requiredRevenue: number;
  requiredRevenueFormatted: string;
  requiredOccupancyPct: number;
  currentOccupancyPct: number;
  currentRevenue: number;
  currentRevenueFormatted: string;
  remainingToGoal: number;
  remainingToGoalFormatted: string;
  estimatedAdr: number;
  estimatedAdrFormatted: string;
  expectedMonthCapacity: number;
  expectedMonthCapacityFormatted: string;
  settings: FinancePlanningSettingsInput;
  repeatedExpenseHints: FinancePlanningRepeatedExpenseHint[];
  hasConfiguration: boolean;
};
