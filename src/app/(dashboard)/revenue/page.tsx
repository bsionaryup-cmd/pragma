import { ModuleShellFlow } from "@/components/layout/module-shell";
import { SmartpriceDashboard } from "@/features/revenue/components/smartprice-dashboard";
import { hasPermission, requirePermission } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { getFinanceOverview } from "@/services/finance/finance.service";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";
import { buildAttentionItems } from "@/services/revenue/revenue-dashboard.service";

export default async function SmartpricePage() {
  const user = await requirePermission("finance:revenue:read");
  const canEditPrices = hasPermission(user.role as AppUserRole, "finance:write");

  const [billing, overview, finance] = await Promise.all([
    getBillingAccessSnapshot(),
    getPriceLabsOverview(false),
    getFinanceOverview("es").catch(() => null),
  ]);

  return (
    <ModuleShellFlow>
      <SmartpriceDashboard
        overview={overview}
        attention={buildAttentionItems(overview.properties)}
        billingLocked={billing.locked}
        canEditPrices={canEditPrices}
        finance={
          finance
            ? {
                occupancyRate: `${finance.comparison.occupancy.current}%`,
                adr: finance.profitability.avgPerReservation
                  ? String(Math.round(finance.profitability.avgPerReservation))
                  : null,
              }
            : null
        }
      />
    </ModuleShellFlow>
  );
}
