import { ModuleShellFlow } from "@/components/layout/module-shell";
import { RevenueDashboard } from "@/features/revenue/components/revenue-dashboard";
import { requirePermission } from "@/lib/auth";
import { getRevenueDashboard } from "@/services/revenue/revenue-dashboard.service";

export default async function RevenuePage() {
  await requirePermission("calendar:read");
  const data = await getRevenueDashboard();
  return (
    <ModuleShellFlow>
      <RevenueDashboard data={data} />
    </ModuleShellFlow>
  );
}
