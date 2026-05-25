import { AirbnbIntegrationPanel } from "@/features/integrations/airbnb/components/airbnb-integration-panel";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getAirbnbSyncStatusForOwner } from "@/services/airbnb/airbnb-ical-sync.service";
import type { AppUserRole } from "@/types/auth";

export default async function AirbnbIntegrationPage() {
  const auth = await requirePermission("integrations:read");
  const canSync = hasPermission(auth.role as AppUserRole, "properties:write");
  const overview = await getAirbnbSyncStatusForOwner(auth.dbUserId);

  return (
    <AirbnbIntegrationPanel overview={overview} canSync={canSync} />
  );
}
