import { resolveWompiConfig } from "@/modules/billing/services/wompi-credentials";
import { hasPaymentLedgerDelegates } from "@/modules/billing/lib/billing-schema-guard";

export async function getPaymentMethodsAvailability() {
  const wompi = await resolveWompiConfig();
  return {
    wompiEnabled: wompi.configured,
    pse: true,
    nequi: true,
    cards: true,
    env: wompi.env,
    ledgerReady: hasPaymentLedgerDelegates(),
  };
}
