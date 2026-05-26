import { AirbnbIntegrationPanel } from "@/features/integrations/airbnb/components/airbnb-integration-panel";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getAirbnbSyncStatusForOwner } from "@/services/airbnb/airbnb-ical-sync.service";
import { getTenantAirbnbEmailIntegration } from "@/services/integrations/tenant-airbnb-email-integration.service";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import type { AppUserRole } from "@/types/auth";

export default async function AirbnbIntegrationPage() {
  const auth = await requirePermission("integrations:read");
  const scope = await requireTenantDataScope();
  const canSync = hasPermission(auth.role as AppUserRole, "properties:write");
  const canManageEmail = hasPermission(auth.role as AppUserRole, "integrations:manage");
  const overview = await getAirbnbSyncStatusForOwner(auth.dbUserId);
  const emailIntegration = scope.organizationId
    ? await getTenantAirbnbEmailIntegration(scope.organizationId)
    : null;

  return (
    <AirbnbIntegrationPanel
      overview={overview}
      canSync={canSync}
      emailIntegration={emailIntegration}
      canManageEmail={canManageEmail}
    />
  );
}
