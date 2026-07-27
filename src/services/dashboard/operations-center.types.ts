import type { CommandCenterData } from "@/services/dashboard/command-center.service";

export type OperationsFinanceSummary = {
  netProfitFormatted: string;
  revenueFormatted: string;
  pendingIncomeFormatted: string;
  revenueTrend: number;
  expenseTrend: number;
  netTrend: number;
};

export type OperationsCenterSnapshot = {
  commandCenter: CommandCenterData;
  finance: OperationsFinanceSummary | null;
};
