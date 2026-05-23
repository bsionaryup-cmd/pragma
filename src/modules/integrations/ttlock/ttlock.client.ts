import type { TTLockIntegration } from "@prisma/client";
import { TTLockIntegrationStatus } from "@prisma/client";
import {
  requestTTLockAddKeyboardPwd,
  requestTTLockDeleteKeyboardPwd,
  requestTTLockLockList,
} from "@/services/integrations/ttlock/ttlock-api.client";
import {
  decryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";
import { isTTLockLiveApiEnabled } from "@/services/integrations/ttlock/ttlock-oauth.client";
import {
  isTTLockIntegrationConnected,
  resolveTTLockIntegrationForProperty,
} from "@/modules/integrations/ttlock/ttlock.persistence";
import type { TTLockApiSession } from "@/modules/integrations/ttlock/ttlock.types";

export {
  requestTTLockAddKeyboardPwd,
  requestTTLockDeleteKeyboardPwd,
  requestTTLockLockList,
};

function hasAppCredentials(integration: {
  clientId: string | null;
  clientSecretEncrypted: string | null;
}): boolean {
  return Boolean(integration.clientId?.trim() && integration.clientSecretEncrypted);
}

export async function resolveTTLockApiSessionForIntegration(
  integration: TTLockIntegration,
): Promise<TTLockApiSession | null> {
  if (!isTTLockIntegrationConnected(integration)) return null;
  if (!hasAppCredentials(integration)) return null;

  const accessToken = decryptTTLockSecret(integration.accessTokenEncrypted);
  if (!accessToken && isTTLockLiveApiEnabled()) return null;

  return {
    integrationId: integration.id,
    organizationId: integration.organizationId,
    clientId: integration.clientId!,
    accessToken: accessToken ?? "placeholder-token",
    environment: integration.environment,
  };
}

export async function resolveTTLockApiSessionForProperty(
  propertyId: string,
): Promise<TTLockApiSession | null> {
  const integration = await resolveTTLockIntegrationForProperty(propertyId);
  if (!integration) return null;
  return resolveTTLockApiSessionForIntegration(integration);
}

export async function probeTTLockConnection(
  integration: TTLockIntegration,
): Promise<{ ok: boolean; message: string; lockCount?: number }> {
  if (!isTTLockLiveApiEnabled()) {
    return {
      ok: isTTLockIntegrationConnected(integration),
      message: "API TTLock en modo preparación (TTLOCK_API_ENABLED=false)",
    };
  }

  const session = await resolveTTLockApiSessionForIntegration(integration);
  if (!session) {
    return { ok: false, message: "Integración TTLock no conectada" };
  }

  const result = await requestTTLockLockList({
    environment: session.environment,
    clientId: session.clientId,
    accessToken: session.accessToken,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return { ok: true, message: "Conexión TTLock verificada", lockCount: result.total };
}

export async function markIntegrationSyncStatus(
  integrationId: string,
  status: TTLockIntegrationStatus,
  lastError?: string | null,
): Promise<void> {
  const { db } = await import("@/lib/db");
  await db.tTLockIntegration.update({
    where: { id: integrationId },
    data: {
      status,
      lastSyncedAt: new Date(),
      ...(lastError !== undefined ? { lastError } : { lastError: null }),
    },
  });
}
