"use server";

import { revalidatePath } from "next/cache";
import type { EpaycoEnvironment } from "@/modules/integrations/epayco/epayco.config";
import {
  getPlatformEpaycoCredentialSnapshot,
  isPlatformEpaycoConfigured,
} from "@/modules/integrations/epayco/epayco-credentials";
import {
  getOrCreatePlatformEpaycoOrganizationId,
  requirePlatformOwnerForEpaycoSettings,
} from "@/modules/billing/services/epayco-platform.service";
import {
  revokeEpaycoCredentialsForOrganization,
  saveEpaycoCredentialsEncrypted,
  setEpaycoIntegrationEnabled,
} from "@/modules/integrations/epayco/epayco-persistence";
import { testEpaycoConnection } from "@/modules/integrations/epayco/epayco-test.service";

function revalidateEpaycoPaths() {
  revalidatePath("/settings/billing");
  revalidatePath("/owner-dashboard");
  revalidatePath("/owner-dashboard/billing");
  revalidatePath("/panel");
}

async function requirePlatformEpaycoScope() {
  const user = await requirePlatformOwnerForEpaycoSettings();
  const organizationId = await getOrCreatePlatformEpaycoOrganizationId();
  return { user, organizationId };
}

export async function getPlatformEpaycoStatusAction() {
  await requirePlatformOwnerForEpaycoSettings();
  const snapshot = await getPlatformEpaycoCredentialSnapshot();
  return {
    configured: await isPlatformEpaycoConfigured(),
    snapshot,
  };
}

export async function savePlatformEpaycoCredentialsAction(input: {
  publicKey: string;
  privateKey?: string;
  pKey?: string;
  custIdCliente?: string;
  env: EpaycoEnvironment;
  preferForSubscriptionPayments?: boolean;
}) {
  const { user, organizationId } = await requirePlatformEpaycoScope();

  const result = await saveEpaycoCredentialsEncrypted({
    organizationId,
    configuredById: user.id,
    publicKey: input.publicKey,
    privateKey: input.privateKey,
    pKey: input.pKey,
    custIdCliente: input.custIdCliente,
    env: input.env,
    preferForSubscriptionPayments: input.preferForSubscriptionPayments,
  });

  revalidateEpaycoPaths();
  return result;
}

export async function revokePlatformEpaycoCredentialsAction() {
  const { organizationId } = await requirePlatformEpaycoScope();
  const result = await revokeEpaycoCredentialsForOrganization(organizationId);
  revalidateEpaycoPaths();
  return result;
}

export async function setPlatformEpaycoEnabledAction(enabled: boolean) {
  const { organizationId } = await requirePlatformEpaycoScope();
  const result = await setEpaycoIntegrationEnabled(organizationId, enabled);
  revalidateEpaycoPaths();
  return result;
}

export async function testPlatformEpaycoConnectionAction() {
  const { organizationId } = await requirePlatformEpaycoScope();
  const result = await testEpaycoConnection(organizationId);
  revalidateEpaycoPaths();
  return result;
}
