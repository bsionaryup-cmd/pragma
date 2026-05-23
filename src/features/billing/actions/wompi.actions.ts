"use server";

import { revalidatePath } from "next/cache";
import type { WompiEnvironment } from "@/modules/billing/config/wompi.config";
import { resolvePlatformWompiConfig } from "@/modules/billing/services/wompi-credentials";
import {
  getOrCreatePlatformWompiOrganizationId,
  requirePlatformOwnerForWompiSettings,
} from "@/modules/billing/services/wompi-platform.service";
import {
  revokeWompiCredentialsForOrganization,
  saveWompiCredentialsEncrypted,
  setWompiIntegrationEnabled,
} from "@/modules/billing/services/wompi-persistence";
import { testWompiConnection } from "@/modules/billing/services/wompi-test.service";

function revalidateWompiPaths() {
  revalidatePath("/settings/billing");
  revalidatePath("/owner-dashboard");
  revalidatePath("/panel");
}

async function requirePlatformWompiScope() {
  const user = await requirePlatformOwnerForWompiSettings();
  const organizationId = await getOrCreatePlatformWompiOrganizationId();
  return { user, organizationId };
}

export async function saveWompiCredentialsAction(input: {
  publicKey: string;
  privateKey?: string;
  eventsSecret?: string;
  integritySecret?: string;
  env: WompiEnvironment;
}) {
  const { user, organizationId } = await requirePlatformWompiScope();

  const result = await saveWompiCredentialsEncrypted({
    organizationId,
    configuredById: user.id,
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
  const { organizationId } = await requirePlatformWompiScope();
  const result = await revokeWompiCredentialsForOrganization(organizationId);
  revalidateWompiPaths();
  return result;
}

export async function setWompiEnabledAction(enabled: boolean) {
  const { organizationId } = await requirePlatformWompiScope();
  const result = await setWompiIntegrationEnabled(organizationId, enabled);
  revalidateWompiPaths();
  return result;
}

export async function testWompiConnectionAction() {
  const { organizationId } = await requirePlatformWompiScope();
  const config = await resolvePlatformWompiConfig();
  const result = await testWompiConnection({ organizationId, config });
  revalidateWompiPaths();
  return result;
}
