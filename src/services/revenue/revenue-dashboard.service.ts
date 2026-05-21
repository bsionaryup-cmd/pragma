import { PropertyPriceLabsSyncStatus } from "@prisma/client";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";
import { getFinanceOverview } from "@/services/finance/finance.service";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";

export type SmartpriceAttentionReason =
  | "underpriced"
  | "overpriced"
  | "sync_error"
  | "pending_sync";

export type SmartpriceAttentionItem = {
  propertyId: string;
  propertyName: string;
  city: string;
  reason: SmartpriceAttentionReason;
  recommendedRate: string | null;
  priceDelta: string | null;
};

/** @deprecated Use SmartpriceDashboardDto */
export type RevenueDashboardDto = SmartpriceDashboardDto;

export type SmartpriceDashboardDto = {
  billingLocked: boolean;
  priceLabs: {
    configured: boolean;
    connected: boolean;
    syncedCount: number;
    propertyCount: number;
    lastPricesSyncAt: string | null;
    underpricedCount: number;
    overpricedCount: number;
    neutralCount: number;
    avgDelta: string | null;
  };
  attention: SmartpriceAttentionItem[];
  finance: {
    occupancyRate: string | null;
    adr: string | null;
  } | null;
};

const ATTENTION_PRIORITY: Record<SmartpriceAttentionReason, number> = {
  sync_error: 0,
  pending_sync: 1,
  underpriced: 2,
  overpriced: 3,
};

function classifyAttention(
  property: PriceLabsOverviewDto["properties"][number],
): SmartpriceAttentionReason | null {
  if (property.lastError) return "sync_error";
  if (property.syncStatus !== PropertyPriceLabsSyncStatus.SYNCED) {
    return "pending_sync";
  }

  const delta =
    property.priceDelta != null
      ? Number.parseFloat(property.priceDelta)
      : null;
  if (delta == null || !Number.isFinite(delta)) return null;
  if (delta < -1) return "underpriced";
  if (delta > 1) return "overpriced";
  return null;
}

function buildAttentionItems(
  properties: PriceLabsOverviewDto["properties"],
): SmartpriceAttentionItem[] {
  return properties
    .map((property) => {
      const reason = classifyAttention(property);
      if (!reason) return null;
      return {
        propertyId: property.id,
        propertyName: property.name,
        city: property.city,
        reason,
        recommendedRate: property.recommendedRate,
        priceDelta: property.priceDelta,
      };
    })
    .filter((item): item is SmartpriceAttentionItem => item != null)
    .sort((a, b) => ATTENTION_PRIORITY[a.reason] - ATTENTION_PRIORITY[b.reason])
    .slice(0, 6);
}

/** @deprecated Use getSmartpriceDashboard */
export async function getRevenueDashboard(): Promise<SmartpriceDashboardDto> {
  return getSmartpriceDashboard();
}

export async function getSmartpriceDashboard(): Promise<SmartpriceDashboardDto> {
  const [billing, plOverview, finance] = await Promise.all([
    getBillingAccessSnapshot(),
    getPriceLabsOverview(false),
    getFinanceOverview("es").catch(() => null),
  ]);

  const synced = plOverview.metrics.syncedCount;
  const total = plOverview.metrics.propertyCount;

  return {
    billingLocked: billing.locked,
    priceLabs: {
      configured: plOverview.config.configured,
      connected: plOverview.integration.status === "CONNECTED",
      syncedCount: synced,
      propertyCount: total,
      lastPricesSyncAt: plOverview.integration.lastPricesSyncAt,
      underpricedCount: plOverview.revenue.underpricedCount,
      overpricedCount: plOverview.revenue.overpricedCount,
      neutralCount: plOverview.revenue.neutralCount,
      avgDelta: plOverview.revenue.avgDelta,
    },
    attention: buildAttentionItems(plOverview.properties),
    finance: finance
      ? {
          occupancyRate: `${finance.comparison.occupancy.current}%`,
          adr: finance.profitability.avgPerReservation
            ? String(Math.round(finance.profitability.avgPerReservation))
            : null,
        }
      : null,
  };
}
