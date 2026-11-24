import dynamic from "next/dynamic";
import { hasPermission, requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import type { AppUserRole } from "@/types/auth";
import { getSmartAccessOverview } from "@/services/access/smart-access.service";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { getOperationalAccessOverview } from "@/services/integrations/ttlock/ttlock-operational-access.service";
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
  const user = await requirePermission("access:read");
  const scope = await requireTenantDataScope();
  const [data, operationalData] = await Promise.all([
    getSmartAccessOverview(),
    getOperationalAccessOverview(scope),
  ]);
  const canManage = hasPermission(user.role as AppUserRole, "access:manage");

  return (
    <SmartAccessDashboard
      data={data}
      operationalData={operationalData}
      canManage={canManage}
    />
  );
}
