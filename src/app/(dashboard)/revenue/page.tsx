import { ModuleShellFlow } from "@/components/layout/module-shell";
import { SmartpriceDashboard } from "@/features/revenue/components/smartprice-dashboard";
import { requirePermission } from "@/lib/auth";
import { getSmartpriceDashboard } from "@/services/revenue/revenue-dashboard.service";

export default async function SmartpricePage() {
  await requirePermission("finance:revenue:read");
  const data = await getSmartpriceDashboard();
  return (
    <ModuleShellFlow>
      <SmartpriceDashboard data={data} />
    </ModuleShellFlow>
  );
}
