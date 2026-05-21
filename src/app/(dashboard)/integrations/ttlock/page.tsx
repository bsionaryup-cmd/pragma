import { TTLockLoadError } from "@/features/integrations/ttlock/components/ttlock-load-error";
import { TTLockPanel } from "@/features/integrations/ttlock/components/ttlock-panel";
import { requirePermission } from "@/lib/auth";
import { resolveRequestContextFromHeaders } from "@/lib/integrations/ttlock-config";
import { isTTLockSchemaDriftError } from "@/services/integrations/ttlock/ttlock-prisma-guard";
import { getTTLockOverview } from "@/services/integrations/ttlock.service";
import { headers } from "next/headers";

type TTLockPageProps = {
  searchParams: Promise<{ error?: string; connected?: string }>;
};

export default async function TTLockIntegrationPage({
  searchParams,
}: TTLockPageProps) {
  const user = await requirePermission("integrations:read");
  const canManage = user.role === "ADMIN";

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
    />
  );
}
