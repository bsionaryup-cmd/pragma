import dynamic from "next/dynamic";
import { TTLockLoadError } from "@/features/integrations/ttlock/components/ttlock-load-error";
import { hasPermission, requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import type { AppUserRole } from "@/types/auth";
import { resolveRequestContextFromHeaders } from "@/lib/integrations/ttlock-config";
import { isTTLockSchemaDriftError } from "@/services/integrations/ttlock/ttlock-prisma-guard";
import { getTTLockOverview } from "@/services/integrations/ttlock.service";
import { headers } from "next/headers";

const TTLockPanel = dynamic(
  () =>
    import("@/features/integrations/ttlock/components/ttlock-panel").then(
      (m) => ({ default: m.TTLockPanel }),
    ),
);

type TTLockPageProps = {
  searchParams: Promise<{
    error?: string;
    connected?: string;
    synced?: string;
    sync?: string;
    disconnected?: string;
    mapped?: string;
  }>;
};

export default async function TTLockIntegrationPage({
  searchParams,
}: TTLockPageProps) {
  await redirectIfMissingPlanFeature("ttlock", "/integrations/ttlock");
  const user = await requirePermission("integrations:read");
  const canManage = hasPermission(user.role as AppUserRole, "integrations:manage");

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const requestOrigin = host ? `${proto}://${host}` : null;
  const request = resolveRequestContextFromHeaders(headerStore, requestOrigin);

  const params = await searchParams;

  let overview: Awaited<ReturnType<typeof getTTLockOverview>> | null = null;
  let loadError: string | null = null;

  try {
    overview = await getTTLockOverview(user.dbUserId, {
      request,
      canManage,
    });
  } catch (error) {
    loadError = isTTLockSchemaDriftError(error)
      ? error instanceof Error
        ? error.message
        : "Esquema TTLock desincronizado"
      : error instanceof Error
        ? error.message
        : "No se pudo cargar la integración TTLock";
  }

  if (loadError) {
    return <TTLockLoadError message={loadError} />;
  }

  return (
    <TTLockPanel
      overview={overview!}
      flashError={params.error ?? null}
      flashConnected={params.connected === "1"}
      flashSynced={params.synced === "1"}
      flashSyncManual={params.sync === "manual"}
      flashDisconnected={params.disconnected === "1"}
      flashMapped={params.mapped === "1"}
    />
  );
}
