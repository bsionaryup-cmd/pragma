import { PriceLabsPanel } from "@/features/integrations/pricelabs/components/pricelabs-panel";
import { hasPermission, requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import type { AppUserRole } from "@/types/auth";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";

export default async function PriceLabsIntegrationPage() {
  await redirectIfMissingPlanFeature("pricelabs", "/integrations/pricelabs");
  const user = await requirePermission("integrations:read");
  const canManage = hasPermission(user.role as AppUserRole, "integrations:manage");
  const overview = await getPriceLabsOverview(canManage);

  return <PriceLabsPanel overview={overview} />;
}
