"use server";

import { revalidatePath } from "next/cache";
import type { WompiEnvironment } from "@/modules/billing/config/wompi.config";
import {
  getWompiCredentialSnapshot,
  isWompiConfiguredForOrganization,
} from "@/modules/billing/services/wompi-credentials";
import {
  revokeWompiCredentialsForOrganization,
  saveWompiCredentialsEncrypted,
  setWompiIntegrationEnabled,
} from "@/modules/billing/services/wompi-persistence";
import { testWompiConnection } from "@/modules/billing/services/wompi-test.service";
import { requireDbUser, requirePermission } from "@/lib/auth";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

async function requireTenantWompiScope() {
  const user = await requireDbUser();
  if (isSuperAdminOwner(user)) {
    throw new Error("Usa la consola de plataforma para Wompi SaaS");
  }
  await requirePermission("integrations:manage");
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) {
    throw new Error("Organización requerida");
  }
  return { user, organizationId: ctx.organizationId };
}

export async function getTenantWompiStatusAction() {
  await requirePermission("integrations:read");
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) {
    return { configured: false, snapshot: null };
  }
  const snapshot = await getWompiCredentialSnapshot(ctx.organizationId);
  return {
    configured: await isWompiConfiguredForOrganization(ctx.organizationId),
    snapshot,
  };
}

export async function saveTenantWompiCredentialsAction(input: {
  publicKey: string;
  privateKey?: string;
  eventsSecret?: string;
  integritySecret?: string;
  env: WompiEnvironment;
}) {
  const { user, organizationId } = await requireTenantWompiScope();
  const result = await saveWompiCredentialsEncrypted({
    organizationId,
    configuredById: user.id,
    publicKey: input.publicKey,
    privateKey: input.privateKey,
    eventsSecret: input.eventsSecret,
    integritySecret: input.integritySecret,
    env: input.env,
  });
  revalidatePath("/integrations/wompi");
  revalidatePath("/finance/payment-links");
  return result;
}

export async function revokeTenantWompiCredentialsAction() {
  const { organizationId } = await requireTenantWompiScope();
  const result = await revokeWompiCredentialsForOrganization(organizationId);
  revalidatePath("/integrations/wompi");
  return result;
}

export async function setTenantWompiEnabledAction(enabled: boolean) {
  const { organizationId } = await requireTenantWompiScope();
  const result = await setWompiIntegrationEnabled(organizationId, enabled);
  revalidatePath("/integrations/wompi");
  return result;
}

export async function testTenantWompiConnectionAction() {
  const { organizationId } = await requireTenantWompiScope();
  const { resolveWompiConfig } = await import(
    "@/modules/billing/services/wompi-credentials"
  );
  const config = await resolveWompiConfig(organizationId);
  const result = await testWompiConnection({ organizationId, config });
  revalidatePath("/integrations/wompi");
  return result;
}
