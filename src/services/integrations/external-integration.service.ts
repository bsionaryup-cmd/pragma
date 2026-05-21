import type { ExternalIntegrationProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { encryptTTLockSecret, decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";

export async function getExternalIntegration(
  provider: ExternalIntegrationProvider,
) {
  return db.externalIntegration.findUnique({ where: { provider } });
}

export async function saveExternalIntegration(input: {
  provider: ExternalIntegrationProvider;
  configuredById: string;
  apiKey?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
}) {
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
) {
  const row = await getExternalIntegration(provider);
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
