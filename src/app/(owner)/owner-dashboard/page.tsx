import { OwnerDashboardView } from "@/components/owner/owner-dashboard-view";
import { requireDbUser } from "@/lib/auth";
import { buildTenantContext } from "@/lib/platform/tenant-context";
import {
  getOwnerDashboardSnapshot,
  listOwnerClients,
} from "@/services/platform/owner-dashboard.service";
import { listPlatformAuditLogs } from "@/services/platform/platform-audit.service";

export default async function OwnerDashboardPage() {
  const user = await requireDbUser();
  const tenantContext = await buildTenantContext(user);

  const [clients, snapshot, logs] = await Promise.all([
    listOwnerClients({ page: 1, pageSize: 20 }),
    getOwnerDashboardSnapshot(),
    listPlatformAuditLogs({ limit: 20 }),
  ]);

  return (
    <OwnerDashboardView
      initialClients={clients}
      initialSnapshot={snapshot}
      initialLogs={logs}
      isImpersonating={tenantContext.isImpersonating}
    />
  );
}
