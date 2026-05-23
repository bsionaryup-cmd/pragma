import "server-only";

import type { TTLockIntegration } from "@prisma/client";
import { TTLockIntegrationStatus } from "@prisma/client";
import { resolveTTLockRedirectUri } from "@/lib/integrations/ttlock-config";
import {
  getPlatformTTLockClientId,
  getPlatformTTLockClientSecret,
  isPlatformTTLockConfigured,
} from "@/lib/integrations/ttlock-platform";
import { db } from "@/lib/db";
import { resolveTenantDataScopeForUserId } from "@/lib/platform/require-tenant-data-scope";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { ensureTTLockIntegrationForScope } from "@/modules/integrations/ttlock/ttlock.persistence";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function resolveTTLockScopeForUser(
  userId: string,
): Promise<TenantDataScope> {
  return resolveTenantDataScopeForUserId(userId);
}

export function integrationHasAppCredentials(integration: {
  clientId: string | null;
  clientSecretEncrypted: string | null;
}): boolean {
  if (isPlatformTTLockConfigured()) return true;
  return Boolean(integration.clientId?.trim() && integration.clientSecretEncrypted);
}

export async function resolveAppCredentials(integration: {
  clientId: string | null;
  clientSecretEncrypted: string | null;
}): Promise<{ clientId: string; clientSecret: string }> {
  if (isPlatformTTLockConfigured()) {
    return {
      clientId: getPlatformTTLockClientId()!,
      clientSecret: getPlatformTTLockClientSecret()!,
    };
  }

  const clientId = integration.clientId?.trim();
  const clientSecret = decryptTTLockSecret(integration.clientSecretEncrypted);
  if (!clientId || !clientSecret) {
    throw new Error("TTLock no está configurado. Contacta al administrador de PRAGMA.");
  }

  return { clientId, clientSecret };
}

async function syncPlatformCredentialsOnIntegration(
  integration: TTLockIntegration,
  configuredById: string,
): Promise<TTLockIntegration> {
  if (!isPlatformTTLockConfigured()) return integration;

  const clientId = getPlatformTTLockClientId()!;
  const clientSecretEncrypted = encryptTTLockSecret(getPlatformTTLockClientSecret()!);
  const resolved = resolveTTLockRedirectUri({
    storedRedirectUri: integration.redirectUri,
  });
  const redirectUri = resolved.redirectUri ?? integration.redirectUri;
  const nextStatus =
    integration.status === TTLockIntegrationStatus.NOT_CONNECTED &&
    integration.accessTokenEncrypted
      ? integration.status
      : integration.accessTokenEncrypted
        ? integration.status
        : integration.status === TTLockIntegrationStatus.INVALID_CREDENTIALS ||
            integration.status === TTLockIntegrationStatus.TOKEN_EXPIRED
          ? integration.status
          : TTLockIntegrationStatus.PENDING_SETUP;

  const needsUpdate =
    integration.clientId !== clientId ||
    !integration.clientSecretEncrypted ||
    integration.redirectUri !== redirectUri;

  if (!needsUpdate) return integration;

  return db.tTLockIntegration.update({
    where: { id: integration.id },
    data: {
      clientId,
      clientSecretEncrypted,
      redirectUri,
      configuredById: integration.configuredById ?? configuredById,
      status:
        integration.status === TTLockIntegrationStatus.CONNECTED ||
        integration.status === TTLockIntegrationStatus.READY
          ? integration.status
          : nextStatus,
      lastError: null,
    },
    include: { automationSettings: true },
  });
}

export async function ensureScopedTTLockIntegration(userId: string) {
  const scope = await resolveTenantDataScopeForUserId(userId);
  const integration = await ensureTTLockIntegrationForScope(scope);
  await syncPlatformCredentialsOnIntegration(integration, userId);
  return db.tTLockIntegration.findUniqueOrThrow({
    where: { id: integration.id },
    include: { automationSettings: true },
  });
}

export function accessTokenNeedsRefresh(integration: {
  accessTokenEncrypted: string | null;
  expiresAt: Date | null;
}): boolean {
  if (!integration.accessTokenEncrypted) return true;
  if (!integration.expiresAt) return false;
  return integration.expiresAt.getTime() - Date.now() <= TOKEN_REFRESH_BUFFER_MS;
}

export async function readIntegrationAccessToken(integration: {
  accessTokenEncrypted: string | null;
}): Promise<string | null> {
  return decryptTTLockSecret(integration.accessTokenEncrypted);
}
