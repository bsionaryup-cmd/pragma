import { PriceLabsPanel } from "@/features/integrations/pricelabs/components/pricelabs-panel";
import { hasPermission, requirePermission } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";

export default async function PriceLabsIntegrationPage() {
  const user = await requirePermission("integrations:read");
  const canManage = hasPermission(user.role as AppUserRole, "integrations:manage");
  const overview = await getPriceLabsOverview(canManage);

  return <PriceLabsPanel overview={overview} />;
}
