import {
  listManualExpensesInRange,
  listOtherIncomesInRange,
} from "@/services/finance/finance-prisma-guard";
import { partitionOtherIncomes } from "@/lib/finance/other-income-policy";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";

export type ManualFinanceInRange = {
  expenses: Awaited<ReturnType<typeof listManualExpensesInRange>>;
  /** Ingresos operativos (sin espejo de links de pago ya contabilizados en reservas). */
  incomes: Awaited<ReturnType<typeof listOtherIncomesInRange>>;
  expenseTotal: number;
  incomeTotal: number;
};

export async function getManualFinanceInRange(
  start: Date,
  end: Date,
  scope: TenantDataScope,
): Promise<ManualFinanceInRange> {
  const [expenses, allIncomes] = await Promise.all([
    listManualExpensesInRange(start, end, scope),
    listOtherIncomesInRange(start, end, scope),
  ]);

  const { operational: incomes } = partitionOtherIncomes(allIncomes);

  return {
    expenses,
    incomes,
    expenseTotal: expenses.reduce((sum, row) => sum + Number(row.amount), 0),
    incomeTotal: incomes.reduce((sum, row) => sum + Number(row.amount), 0),
  };
}
