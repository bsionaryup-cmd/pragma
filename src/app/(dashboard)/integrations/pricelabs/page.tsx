import { PriceLabsPanel } from "@/features/integrations/pricelabs/components/pricelabs-panel";
import { requirePermission } from "@/lib/auth";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";

export default async function PriceLabsIntegrationPage() {
  const user = await requirePermission("integrations:read");
  const canManage = user.role === "ADMIN";
  const overview = await getPriceLabsOverview(canManage);

  return <PriceLabsPanel overview={overview} />;
}
