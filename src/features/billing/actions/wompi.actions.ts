"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";
import type { WompiEnvironment } from "@/modules/billing/config/wompi.config";
import { resolveWompiConfig } from "@/modules/billing/services/wompi-credentials";
import {
  revokeWompiCredentialsForOrganization,
  saveWompiCredentialsEncrypted,
  setWompiIntegrationEnabled,
} from "@/modules/billing/services/wompi-persistence";
import { testWompiConnection } from "@/modules/billing/services/wompi-test.service";

function revalidateWompiPaths() {
  revalidatePath("/settings/billing");
  revalidatePath("/panel");
}

async function requireBillingOrganizationId() {
  const user = await requirePermission("billing:manage");
  const organizationId = await getEffectiveOrganizationIdForUser(user.dbUserId);
  if (!organizationId) {
    throw new Error("Organización no encontrada");
  }
  return { user, organizationId };
}

export async function saveWompiCredentialsAction(input: {
  publicKey: string;
  privateKey?: string;
  eventsSecret?: string;
  integritySecret?: string;
  env: WompiEnvironment;
}) {
  const { user, organizationId } = await requireBillingOrganizationId();

  const result = await saveWompiCredentialsEncrypted({
    organizationId,
    configuredById: user.dbUserId,
    publicKey: input.publicKey,
    privateKey: input.privateKey,
    eventsSecret: input.eventsSecret,
    integritySecret: input.integritySecret,
    env: input.env,
  });

  revalidateWompiPaths();
  return result;
}

export async function revokeWompiCredentialsAction() {
  const { organizationId } = await requireBillingOrganizationId();
  const result = await revokeWompiCredentialsForOrganization(organizationId);
  revalidateWompiPaths();
  return result;
}

export async function setWompiEnabledAction(enabled: boolean) {
  const { organizationId } = await requireBillingOrganizationId();
  const result = await setWompiIntegrationEnabled(organizationId, enabled);
  revalidateWompiPaths();
  return result;
}

export async function testWompiConnectionAction() {
  const { organizationId } = await requireBillingOrganizationId();
  const config = await resolveWompiConfig(organizationId);
  const result = await testWompiConnection({ organizationId, config });
  revalidateWompiPaths();
  return result;
}
