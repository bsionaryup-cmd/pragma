import "server-only";

import type { Locale } from "@/i18n/types";
import { db } from "@/lib/db";
import {
  mergePropertyScope,
  type TenantDataScope,
} from "@/lib/platform/tenant-data-scope";
import { buildAttentionItems } from "@/services/dashboard/operations-center.attention";
import {
  createEmptyCommandCenterData,
  getCommandCenterData,
} from "@/services/dashboard/command-center.service";
import type {
  OperationsCenterSnapshot,
  OperationsFinanceSummary,
} from "@/services/dashboard/operations-center.types";
import {
  getFinanceOverview,
  type FinanceOverview,
} from "@/services/finance/finance.service";
import {
  getSmartAccessOverview,
  type SmartAccessOverview,
} from "@/services/access/smart-access.service";
import { listOperationalFeedCardsForTenant } from "@/services/novedades/operational-feed.service";
import { countInboxAttentionFromFeedCards } from "@/services/dashboard/operations-center.feed-attention";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

function logPanelSecondaryFailure(label: string, error: unknown) {
  console.error(
    `[operations-center] ${label} soft-failed:`,
    error instanceof Error ? error.message : error,
  );
}

async function loadFeedCardsSafe(
  scope: Awaited<ReturnType<typeof requireTenantDataScope>>,
): Promise<OperationalFeedCard[]> {
  try {
    return await listOperationalFeedCardsForTenant(scope, 80);
  } catch (error) {
    logPanelSecondaryFailure("operational-feed", error);
    return [];
  }
}

async function loadFinanceSafe(
  locale: Locale,
  enabled: boolean,
): Promise<FinanceOverview | null> {
  if (!enabled) return null;
  try {
    return await getFinanceOverview(locale);
  } catch (error) {
    logPanelSecondaryFailure("finance-overview", error);
    return null;
  }
}

async function loadSmartAccessSafe(
  enabled: boolean,
): Promise<SmartAccessOverview | null> {
  if (!enabled) return null;
  try {
    return await getSmartAccessOverview();
  } catch (error) {
    logPanelSecondaryFailure("smart-access", error);
    return null;
  }
}

async function loadCommandCenterSafe(locale: Locale): Promise<{
  data: Awaited<ReturnType<typeof getCommandCenterData>>;
  degraded: boolean;
}> {
  try {
    return { data: await getCommandCenterData(locale), degraded: false };
  } catch (error) {
    logPanelSecondaryFailure("command-center", error);
    return { data: createEmptyCommandCenterData(locale), degraded: true };
  }
}

async function loadReliablePropertyCountSafe(
  scope: TenantDataScope,
): Promise<number | null> {
  try {
    return await db.property.count({
      where: mergePropertyScope(scope, {}),
    });
  } catch (error) {
    logPanelSecondaryFailure("property-count", error);
    return null;
  }
}

export async function getOperationsCenterSnapshot(input: {
  locale: Locale;
  canReadFinance: boolean;
  canReadAccess: boolean;
}): Promise<OperationsCenterSnapshot> {
  try {
    const scope = await requireTenantDataScope();

    const feedCardsAll = await loadFeedCardsSafe(scope);
    const inboxAttentionCount = countInboxAttentionFromFeedCards(feedCardsAll);
    const feedCards = feedCardsAll.slice(0, 8);

    const [commandCenterResult, financeOverview, smartAccessOverview, reliablePropertyCount] =
      await Promise.all([
        loadCommandCenterSafe(input.locale),
        loadFinanceSafe(input.locale, input.canReadFinance),
        loadSmartAccessSafe(input.canReadAccess),
        loadReliablePropertyCountSafe(scope),
      ]);

    const commandCenter = commandCenterResult.data;
    // Prefer reliable count over soft-fail empty snapshot (false “no properties”).
    if (
      reliablePropertyCount != null &&
      commandCenter.totalPropertyCount !== reliablePropertyCount
    ) {
      commandCenter.totalPropertyCount = reliablePropertyCount;
    }

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
      attentionTotal: attention.reduce(
        (sum, row) => sum + Math.max(row.count, 1),
        0,
      ),
      inboxAttentionCount,
      feedCards,
      finance,
      smartAccessPending,
      reliablePropertyCount,
      commandCenterDegraded: commandCenterResult.degraded,
    };
  } catch (error) {
    logPanelSecondaryFailure("snapshot-top-level", error);
    const commandCenter = createEmptyCommandCenterData(input.locale);
    return {
      commandCenter,
      attention: [],
      attentionTotal: 0,
      inboxAttentionCount: 0,
      feedCards: [],
      finance: null,
      smartAccessPending: 0,
      // Unknown — never claim empty org when scope itself failed.
      reliablePropertyCount: null,
      commandCenterDegraded: true,
    };
  }
}
