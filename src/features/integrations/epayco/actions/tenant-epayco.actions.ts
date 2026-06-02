"use server";

import { revalidatePath } from "next/cache";
import type { EpaycoEnvironment } from "@/modules/integrations/epayco/epayco.config";
import {
  getEpaycoCredentialSnapshot,
  isEpaycoConfiguredForOrganization,
} from "@/modules/integrations/epayco/epayco-credentials";
import {
  revokeEpaycoCredentialsForOrganization,
  saveEpaycoCredentialsEncrypted,
  setEpaycoIntegrationEnabled,
} from "@/modules/integrations/epayco/epayco-persistence";
import { testEpaycoConnection } from "@/modules/integrations/epayco/epayco-test.service";
import { requireDbUser, requirePermission } from "@/lib/auth";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

async function requireTenantEpaycoScope() {
  const user = await requireDbUser();
  if (isSuperAdminOwner(user)) {
    throw new Error("Usa la consola de plataforma para integraciones globales");
  }
  await requirePermission("integrations:manage");
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) {
    throw new Error("Organización requerida");
  }
  return { user, organizationId: ctx.organizationId };
}

export async function getTenantEpaycoStatusAction() {
  await requirePermission("integrations:read");
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) {
    return { configured: false, snapshot: null };
  }
  const snapshot = await getEpaycoCredentialSnapshot(ctx.organizationId);
  return {
    configured: await isEpaycoConfiguredForOrganization(ctx.organizationId),
    snapshot,
  };
}

export async function saveTenantEpaycoCredentialsAction(input: {
  publicKey: string;
  privateKey?: string;
  pKey?: string;
  custIdCliente?: string;
  env: EpaycoEnvironment;
  preferForGuestPayments?: boolean;
}) {
  const { user, organizationId } = await requireTenantEpaycoScope();
  const result = await saveEpaycoCredentialsEncrypted({
    organizationId,
    configuredById: user.id,
    publicKey: input.publicKey,
    privateKey: input.privateKey,
    pKey: input.pKey,
    custIdCliente: input.custIdCliente,
    env: input.env,
    preferForGuestPayments: input.preferForGuestPayments,
  });
  revalidatePath("/integrations/epayco");
  revalidatePath("/finance/payment-links");
  return result;
}

export async function revokeTenantEpaycoCredentialsAction() {
  const { organizationId } = await requireTenantEpaycoScope();
  const result = await revokeEpaycoCredentialsForOrganization(organizationId);
  revalidatePath("/integrations/epayco");
  return result;
}

export async function setTenantEpaycoEnabledAction(enabled: boolean) {
  const { organizationId } = await requireTenantEpaycoScope();
  const result = await setEpaycoIntegrationEnabled(organizationId, enabled);
  revalidatePath("/integrations/epayco");
  return result;
}

export async function testTenantEpaycoConnectionAction() {
  const { organizationId } = await requireTenantEpaycoScope();
  const result = await testEpaycoConnection(organizationId);
  revalidatePath("/integrations/epayco");
  return result;
}
