"use server";

import { revalidatePath } from "next/cache";
import type { ExternalIntegrationProvider } from "@prisma/client";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requirePermission } from "@/lib/auth";
import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";
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
  await assertBillingUnlocked();
  const organizationId = await getEffectiveOrganizationIdForUser(auth.dbUserId);
  await saveExternalIntegration({
    provider,
    configuredById: auth.dbUserId,
    organizationId,
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
  const auth = await requirePermission("integrations:manage");
  await assertBillingUnlocked();
  const organizationId = await getEffectiveOrganizationIdForUser(auth.dbUserId);
  const result = await testExternalIntegration(provider, organizationId);
  revalidatePath(`/integrations/${provider.toLowerCase()}`);
  return result;
}

export async function getExternalIntegrationOverviewAction(
  provider: ExternalIntegrationProvider,
) {
  const auth = await requirePermission("integrations:read");
  const organizationId = await getEffectiveOrganizationIdForUser(auth.dbUserId);
  const row = await getExternalIntegration(provider, organizationId);
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

/** @deprecated Use getExternalIntegrationOverviewAction */
export const getExternalIntegrationOverview = getExternalIntegrationOverviewAction;
