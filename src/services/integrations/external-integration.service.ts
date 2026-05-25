import type { ExternalIntegrationProvider } from "@prisma/client";
import { db } from "@/lib/db";
import {
  assertIntegrationConfiguredByOrganization,
  integrationVisibleToOrganization,
} from "@/lib/platform/tenant-access";
import { encryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";
import { runSireConnectionTest } from "@/services/integrations/sire/test-sire-connection";
import { runTraaConnectionTest } from "@/services/integrations/traa/test-traa-connection";

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

async function persistConnectionTestResult(
  provider: ExternalIntegrationProvider,
  outcome: {
    ok: boolean;
    message: string;
    tokenToStore?: string | null;
  },
) {
  await db.externalIntegration.update({
    where: { provider },
    data: {
      status: outcome.ok ? "CONNECTED" : "ERROR",
      lastError: outcome.ok ? null : outcome.message,
      lastTestedAt: new Date(),
      ...(outcome.ok && outcome.tokenToStore
        ? { tokenEncrypted: outcome.tokenToStore }
        : {}),
    },
  });
}

export async function testExternalIntegration(
  provider: ExternalIntegrationProvider,
  organizationId: string | null,
) {
  const row = await getExternalIntegration(provider, organizationId);
  if (!row) {
    return { ok: false, message: "Integración no configurada" };
  }

  if (provider === "SIRE") {
    const outcome = await runSireConnectionTest({
      clientId: row.clientId,
      callbackUrl: row.callbackUrl,
      apiKeyEncrypted: row.apiKeyEncrypted,
      clientSecretEncrypted: row.clientSecretEncrypted,
      tokenEncrypted: row.tokenEncrypted,
    });

    await persistConnectionTestResult(provider, outcome);
    return { ok: outcome.ok, message: outcome.message };
  }

  if (provider === "TRAA") {
    const outcome = await runTraaConnectionTest({
      clientId: row.clientId,
      apiKeyEncrypted: row.apiKeyEncrypted,
      tokenEncrypted: row.tokenEncrypted,
    });

    await persistConnectionTestResult(provider, outcome);
    return { ok: outcome.ok, message: outcome.message };
  }

  return { ok: false, message: "Proveedor de integración no soportado" };
}
