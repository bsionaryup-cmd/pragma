import "server-only";

import type { Locale } from "@/i18n/types";
import { getCommandCenterData } from "@/services/dashboard/command-center.service";
import type {
  OperationsCenterSnapshot,
  OperationsFinanceSummary,
} from "@/services/dashboard/operations-center.types";
import { getFinanceOverview } from "@/services/finance/finance.service";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";

export async function getOperationsCenterSnapshot(input: {
  locale: Locale;
  canReadFinance: boolean;
}): Promise<OperationsCenterSnapshot> {
  await requireTenantDataScope();

  const [commandCenter, financeOverview] = await Promise.all([
    getCommandCenterData(input.locale),
    input.canReadFinance ? getFinanceOverview(input.locale) : Promise.resolve(null),
  ]);

  let finance: OperationsFinanceSummary | null = null;
  if (financeOverview) {
    finance = {
      netProfitFormatted: financeOverview.kpis.netProfitFormatted,
      revenueFormatted: financeOverview.kpis.revenueFormatted,
      pendingIncomeFormatted: financeOverview.kpis.pendingIncomeFormatted,
      revenueTrend: financeOverview.comparison.revenue.trend,
      expenseTrend: financeOverview.comparison.expenses.trend,
      netTrend: financeOverview.comparison.profit.trend,
    };
  }

  return {
    commandCenter,
    finance,
  };
}
