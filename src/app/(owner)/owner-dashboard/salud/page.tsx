import { redirect } from "next/navigation";
import { OwnerHealthCheckView } from "@/components/owner/owner-health-check-view";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { getPlatformHealthSnapshot } from "@/services/platform/platform-health.service";

export const dynamic = "force-dynamic";

export default async function OwnerHealthPage() {
  try {
    await requirePlatformOwnerUser();
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) redirect("/unauthorized");
    throw error;
  }

  const snapshot = await getPlatformHealthSnapshot();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-pragma-electric">
          Observabilidad
        </p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">Health Check</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Panel interno Owner — Core, PMS, Retail, QR Mobility, Inventory Intelligence, workers,
          cron y base de datos. Solo lectura; no altera tenants.
        </p>
      </header>
      <OwnerHealthCheckView snapshot={snapshot} />
    </div>
  );
}
