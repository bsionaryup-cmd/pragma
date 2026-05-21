"use server";

import { revalidatePath } from "next/cache";
import type { ExternalIntegrationProvider } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import {
  getExternalIntegration,
  saveExternalIntegration,
  testExternalIntegration,
} from "@/services/integrations/external-integration.service";

export async function saveExternalIntegrationAction(
  provider: ExternalIntegrationProvider,
  formData: FormData,
) {
  const auth = await requirePermission("integrations:manage");
  await saveExternalIntegration({
    provider,
    configuredById: auth.dbUserId,
    apiKey: String(formData.get("apiKey") ?? ""),
    token: String(formData.get("token") ?? ""),
    clientId: String(formData.get("clientId") ?? ""),
    clientSecret: String(formData.get("clientSecret") ?? ""),
    callbackUrl: String(formData.get("callbackUrl") ?? ""),
  });
  revalidatePath(`/integrations/${provider.toLowerCase()}`);
  revalidatePath("/integrations");
}

export async function testExternalIntegrationAction(
  provider: ExternalIntegrationProvider,
) {
  await requirePermission("integrations:manage");
  const result = await testExternalIntegration(provider);
  revalidatePath(`/integrations/${provider.toLowerCase()}`);
  return result;
}

export async function getExternalIntegrationOverview(
  provider: ExternalIntegrationProvider,
) {
  const row = await getExternalIntegration(provider);
  if (!row) return null;
  return {
    clientId: row.clientId,
    callbackUrl: row.callbackUrl,
    status: row.status,
    lastError: row.lastError,
    hasApiKey: Boolean(row.apiKeyEncrypted),
    hasSecret: Boolean(row.clientSecretEncrypted),
  };
}
