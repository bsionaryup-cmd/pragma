import { resolvePlatformWompiConfig } from "@/modules/billing/services/wompi-credentials";
import { isPlatformEpaycoConfigured } from "@/modules/integrations/epayco/epayco-credentials";
import { hasPaymentLedgerDelegates } from "@/modules/billing/lib/billing-schema-guard";
import {
  resolveSubscriptionPaymentGateway,
  type SubscriptionPaymentGateway,
} from "@/modules/billing/services/subscription-payment-gateway.service";

export async function getPaymentMethodsAvailability(
  _organizationId?: string | null,
) {
  const [wompi, epaycoConfigured, gateway] = await Promise.all([
    resolvePlatformWompiConfig(),
    isPlatformEpaycoConfigured(),
    resolveSubscriptionPaymentGateway(),
  ]);

  return {
    wompiEnabled: wompi.configured,
    epaycoEnabled: epaycoConfigured,
    onlinePaymentsEnabled: Boolean(gateway),
    subscriptionGateway: gateway,
    pse: true,
    nequi: true,
    cards: true,
    env: wompi.configured ? wompi.env : "test",
    ledgerReady: hasPaymentLedgerDelegates(),
  };
}

export type SubscriptionPaymentMethods = Awaited<
  ReturnType<typeof getPaymentMethodsAvailability>
> & {
  subscriptionGateway: SubscriptionPaymentGateway | null;
};
