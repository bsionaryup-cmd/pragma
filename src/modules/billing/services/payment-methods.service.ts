import { resolvePlatformWompiConfig } from "@/modules/billing/services/wompi-credentials";
import { hasPaymentLedgerDelegates } from "@/modules/billing/lib/billing-schema-guard";

export async function getPaymentMethodsAvailability(
  _organizationId?: string | null,
) {
  const wompi = await resolvePlatformWompiConfig();

  return {
    wompiEnabled: wompi.configured,
    pse: true,
    nequi: true,
    cards: true,
    env: wompi.env,
    ledgerReady: hasPaymentLedgerDelegates(),
  };
}
