import dynamic from "next/dynamic";
import { hasPermission, requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import type { AppUserRole } from "@/types/auth";
import { getSmartAccessOverview } from "@/services/access/smart-access.service";
import { PragmaLoader } from "@/components/brand/pragma-loader";

const SmartAccessDashboard = dynamic(
  () =>
    import("@/features/smart-access/components/smart-access-dashboard").then(
      (m) => ({
        default: m.SmartAccessDashboard,
      }),
    ),
  {
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PragmaLoader size="lg" />
      </div>
    ),
  },
);

export default async function SmartAccessPage() {
  await redirectIfMissingPlanFeature("ttlock", "/smart-access");
  const [user, data] = await Promise.all([
    requirePermission("access:read"),
    getSmartAccessOverview(),
  ]);
  const canManage = hasPermission(user.role as AppUserRole, "access:manage");

  return <SmartAccessDashboard data={data} canManage={canManage} />;
}
