import "server-only";

import type { Locale } from "@/i18n/types";
import { buildAttentionItems } from "@/services/dashboard/operations-center.attention";
import { getCommandCenterData } from "@/services/dashboard/command-center.service";
import type {
  OperationsCenterSnapshot,
  OperationsFinanceSummary,
} from "@/services/dashboard/operations-center.types";
import { getFinanceOverview } from "@/services/finance/finance.service";
import { getSmartAccessOverview } from "@/services/access/smart-access.service";
import { getNovedadesInboxSnapshot } from "@/services/novedades/novedades-inbox.service";
import { listOperationalFeedCardsForTenant } from "@/services/novedades/operational-feed.service";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";

export async function getOperationsCenterSnapshot(input: {
  locale: Locale;
  canReadFinance: boolean;
  canReadAccess: boolean;
}): Promise<OperationsCenterSnapshot> {
  const scope = await requireTenantDataScope();

  const [commandCenter, inboxSnapshot, feedCards, financeOverview, smartAccessOverview] =
    await Promise.all([
      getCommandCenterData(input.locale),
      getNovedadesInboxSnapshot(scope, 40),
      listOperationalFeedCardsForTenant(scope, 8),
      input.canReadFinance ? getFinanceOverview(input.locale) : Promise.resolve(null),
      input.canReadAccess ? getSmartAccessOverview() : Promise.resolve(null),
    ]);

  const inboxAttentionCount = inboxSnapshot.items.reduce(
    (sum, row) => sum + row.attentionCount,
    0,
  );

  const smartAccessPending = smartAccessOverview
    ? smartAccessOverview.metrics.awaitingRegistration +
      smartAccessOverview.metrics.readyForCode
    : 0;

  const pendingIncome = financeOverview?.kpis.pendingIncome ?? 0;

  const attention = buildAttentionItems({
    commandCenter,
    inboxAttentionCount,
    smartAccessPending,
    pendingIncome,
  });

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
    attention,
    attentionTotal: attention.reduce((sum, row) => sum + Math.max(row.count, 1), 0),
    inboxAttentionCount,
    feedCards,
    finance,
    smartAccessPending,
  };
}
