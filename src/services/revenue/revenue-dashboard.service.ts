import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";
import { getFinanceOverview } from "@/services/finance/finance.service";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";

export type RevenueDashboardDto = {
  billingLocked: boolean;
  priceLabs: {
    configured: boolean;
    connected: boolean;
    syncedCount: number;
    propertyCount: number;
    lastPricesSyncAt: string | null;
    underpricedCount: number;
    overpricedCount: number;
    avgDelta: string | null;
    overridesHint: string;
  };
  finance: {
    monthlyRevenue: string | null;
    occupancyRate: string | null;
    adr: string | null;
  } | null;
};

export async function getRevenueDashboard(): Promise<RevenueDashboardDto> {
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
      avgDelta: plOverview.revenue.avgDelta,
      overridesHint:
        synced > 0
          ? "Overrides en meta por propiedad (sincroniza desde PriceLabs)"
          : "Conecta PriceLabs para precios dinámicos",
    },
    finance: finance
      ? {
          monthlyRevenue: finance.kpis.revenueFormatted,
          occupancyRate: `${finance.comparison.occupancy.current}%`,
          adr: finance.profitability.avgPerReservation
            ? String(Math.round(finance.profitability.avgPerReservation))
            : null,
        }
      : null,
  };
}
