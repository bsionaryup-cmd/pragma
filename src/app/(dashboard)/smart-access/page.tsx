import { SmartAccessDashboard } from "@/features/smart-access/components/smart-access-dashboard";
import { hasPermission, requirePermission } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { getSmartAccessOverview } from "@/services/access/smart-access.service";

export default async function SmartAccessPage() {
  const user = await requirePermission("access:read");
  const canManage = hasPermission(user.role as AppUserRole, "access:manage");
  const data = await getSmartAccessOverview();

  return <SmartAccessDashboard data={data} canManage={canManage} />;
}
