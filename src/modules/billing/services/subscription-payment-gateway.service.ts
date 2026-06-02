import "server-only";

import { resolvePlatformWompiConfig } from "@/modules/billing/services/wompi-credentials";
import { isPlatformEpaycoConfigured } from "@/modules/integrations/epayco/epayco-credentials";
import { getEpaycoIntegrationForOrganization } from "@/modules/integrations/epayco/epayco-persistence";
import { resolvePlatformEpaycoOrganizationId } from "@/modules/billing/services/epayco-platform.service";

export type SubscriptionPaymentGateway = "EPAYCO" | "WOMPI";

export async function resolveSubscriptionPaymentGateway(): Promise<SubscriptionPaymentGateway | null> {
  const [wompi, epaycoConfigured, platformEpaycoOrgId] = await Promise.all([
    resolvePlatformWompiConfig(),
    isPlatformEpaycoConfigured(),
    resolvePlatformEpaycoOrganizationId(),
  ]);

  const epaycoRow = platformEpaycoOrgId
    ? await getEpaycoIntegrationForOrganization(platformEpaycoOrgId)
    : null;

  if (
    epaycoRow?.enabled &&
    epaycoRow.preferForSubscriptionPayments &&
    epaycoConfigured
  ) {
    return "EPAYCO";
  }

  if (wompi.configured) return "WOMPI";
  if (epaycoConfigured) return "EPAYCO";

  return null;
}

export async function isSubscriptionPaymentAvailable(): Promise<boolean> {
  return (await resolveSubscriptionPaymentGateway()) !== null;
}
