import "server-only";

import { isEpaycoConfiguredForOrganization } from "@/modules/integrations/epayco/epayco-credentials";
import { getEpaycoIntegrationForOrganization } from "@/modules/integrations/epayco/epayco-persistence";
import { isWompiConfiguredForOrganization } from "@/modules/billing/services/wompi-credentials";

export type GuestPaymentGateway = "EPAYCO" | "WOMPI";

export async function resolveGuestPaymentGateway(
  organizationId: string,
): Promise<GuestPaymentGateway | null> {
  const [epayco, wompiConfigured] = await Promise.all([
    getEpaycoIntegrationForOrganization(organizationId),
    isWompiConfiguredForOrganization(organizationId),
  ]);

  const epaycoConfigured = await isEpaycoConfiguredForOrganization(organizationId);

  if (epayco?.enabled && epayco.preferForGuestPayments && epaycoConfigured) {
    return "EPAYCO";
  }

  if (wompiConfigured) return "WOMPI";
  if (epaycoConfigured) return "EPAYCO";

  return null;
}
