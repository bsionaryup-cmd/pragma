import {
  listManualExpensesInRange,
  listOtherIncomesInRange,
} from "@/services/finance/finance-prisma-guard";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";

export type ManualFinanceInRange = {
  expenses: Awaited<ReturnType<typeof listManualExpensesInRange>>;
  incomes: Awaited<ReturnType<typeof listOtherIncomesInRange>>;
  expenseTotal: number;
  incomeTotal: number;
};

export async function getManualFinanceInRange(
  start: Date,
  end: Date,
  scope: TenantDataScope,
): Promise<ManualFinanceInRange> {
  const [expenses, incomes] = await Promise.all([
    listManualExpensesInRange(start, end, scope),
    listOtherIncomesInRange(start, end, scope),
  ]);

  return {
    expenses,
    incomes,
    expenseTotal: expenses.reduce((sum, row) => sum + Number(row.amount), 0),
    incomeTotal: incomes.reduce((sum, row) => sum + Number(row.amount), 0),
  };
}
