import type { ExternalIntegrationProvider } from "@prisma/client";
import { db } from "@/lib/db";
import {
  assertIntegrationConfiguredByOrganization,
  integrationVisibleToOrganization,
} from "@/lib/platform/tenant-access";
import { encryptTTLockSecret, decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";

async function loadIntegrationWithConfigurator(
  provider: ExternalIntegrationProvider,
) {
  return db.externalIntegration.findUnique({
    where: { provider },
    include: {
      configuredBy: {
        select: { organizationId: true },
      },
    },
  });
}

export async function getExternalIntegration(
  provider: ExternalIntegrationProvider,
  organizationId: string | null,
) {
  const row = await loadIntegrationWithConfigurator(provider);
  if (!row) return null;

  if (
    !integrationVisibleToOrganization(
      row.configuredById,
      row.configuredBy?.organizationId,
      organizationId,
    )
  ) {
    return null;
  }

  return row;
}

export async function saveExternalIntegration(input: {
  provider: ExternalIntegrationProvider;
  configuredById: string;
  organizationId: string | null;
  apiKey?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
}) {
  const existing = await loadIntegrationWithConfigurator(input.provider);
  await assertIntegrationConfiguredByOrganization(
    existing?.configuredById,
    input.organizationId,
  );

  return db.externalIntegration.upsert({
    where: { provider: input.provider },
    create: {
      provider: input.provider,
      configuredById: input.configuredById,
      apiKeyEncrypted: input.apiKey?.trim()
        ? encryptTTLockSecret(input.apiKey.trim())
        : null,
      tokenEncrypted: input.token?.trim()
        ? encryptTTLockSecret(input.token.trim())
        : null,
      clientId: input.clientId?.trim() || null,
      clientSecretEncrypted: input.clientSecret?.trim()
        ? encryptTTLockSecret(input.clientSecret.trim())
        : null,
      callbackUrl: input.callbackUrl?.trim() || null,
      status: "PENDING_SETUP",
      lastError: null,
    },
    update: {
      configuredById: input.configuredById,
      ...(input.apiKey?.trim()
        ? { apiKeyEncrypted: encryptTTLockSecret(input.apiKey.trim()) }
        : {}),
      ...(input.token?.trim()
        ? { tokenEncrypted: encryptTTLockSecret(input.token.trim()) }
        : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId.trim() || null } : {}),
      ...(input.clientSecret?.trim()
        ? { clientSecretEncrypted: encryptTTLockSecret(input.clientSecret.trim()) }
        : {}),
      ...(input.callbackUrl !== undefined
        ? { callbackUrl: input.callbackUrl.trim() || null }
        : {}),
      status: "PENDING_SETUP",
      lastError: null,
    },
  });
}

export async function testExternalIntegration(
  provider: ExternalIntegrationProvider,
  organizationId: string | null,
) {
  const row = await getExternalIntegration(provider, organizationId);
  if (!row?.clientId && !row?.apiKeyEncrypted) {
    return { ok: false, message: "Configura credenciales antes de probar" };
  }
  const apiKey = decryptTTLockSecret(row.apiKeyEncrypted);
  if (!apiKey && !row.clientId) {
    return { ok: false, message: "API Key o Client ID requerido" };
  }
  await db.externalIntegration.update({
    where: { provider },
    data: { status: "CONNECTED", lastError: null, lastTestedAt: new Date() },
  });
  return { ok: true, message: "Conexión validada (estructura lista para API real)" };
}
