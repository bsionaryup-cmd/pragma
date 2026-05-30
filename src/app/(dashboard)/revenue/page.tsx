import dynamic from "next/dynamic";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { hasPermission, requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import type { AppUserRole } from "@/types/auth";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { getFinanceOverview } from "@/services/finance/finance.service";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";

const SmartpriceDashboard = dynamic(
  () =>
    import("@/features/revenue/components/smartprice-dashboard").then((m) => ({
      default: m.SmartpriceDashboard,
    })),
);

export default async function SmartpricePage() {
  await redirectIfMissingPlanFeature("revenue", "/revenue");
  const userPromise = requirePermission("finance:revenue:read");
  const [user, billing, overview, finance] = await Promise.all([
    userPromise,
    getBillingAccessSnapshot(),
    getPriceLabsOverview(false),
    getFinanceOverview("es").catch(() => null),
  ]);
  const canEditPrices = hasPermission(user.role as AppUserRole, "finance:write");

  return (
    <ModuleShellFlow className="bg-background">
      <SmartpriceDashboard
        overview={overview}
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
