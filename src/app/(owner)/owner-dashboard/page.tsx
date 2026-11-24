import { OwnerDashboardView } from "@/components/owner/owner-dashboard-view";
import { requireDbUser } from "@/lib/auth";
import { buildTenantContext } from "@/lib/platform/tenant-context";
import {
  getOwnerDashboardSnapshot,
  listOwnerClients,
} from "@/services/platform/owner-dashboard.service";
import { listPlatformAuditLogs } from "@/services/platform/platform-audit.service";

type OwnerDashboardPageProps = {
  searchParams: Promise<{ impersonation_error?: string }>;
};

export default async function OwnerDashboardPage({
  searchParams,
}: OwnerDashboardPageProps) {
  const user = await requireDbUser();
  const tenantContext = await buildTenantContext(user);
  const params = await searchParams;

  const [clients, snapshot, logs] = await Promise.all([
    listOwnerClients({ page: 1, pageSize: 20 }),
    getOwnerDashboardSnapshot(),
    listPlatformAuditLogs({ limit: 20 }),
  ]);

  const impersonationError =
    params.impersonation_error === "cookie_missing" ||
    params.impersonation_error === "session_inactive"
      ? "No se pudo activar la impersonación (cookie/sesión). Intenta de nuevo."
      : null;

  return (
    <OwnerDashboardView
      initialClients={clients}
      initialSnapshot={snapshot}
      initialLogs={logs}
      isImpersonating={tenantContext.isImpersonating}
      impersonationError={impersonationError}
    />
  );
}
