import type { PaymentProviderCheckoutInput, PaymentProviderCheckoutResult } from "@/modules/billing/domain/types";
import type { PaymentProviderAdapter } from "@/modules/billing/providers/payment-provider";
import { getPublicAppUrl } from "@/lib/app-url";
import { isPlatformEpaycoConfigured } from "@/modules/integrations/epayco/epayco-credentials";

export class EpaycoPaymentAdapter implements PaymentProviderAdapter {
  readonly code = "EPAYCO" as const;

  isConfigured(): boolean {
    return false;
  }

  async createCheckout(
    input: PaymentProviderCheckoutInput,
  ): Promise<PaymentProviderCheckoutResult> {
    const configured = await isPlatformEpaycoConfigured();
    if (!configured) {
      return {
        ok: false,
        message: "ePayco no configurado para suscripciones PRAGMA",
      };
    }

    const checkoutUrl = `${getPublicAppUrl()}/pay/epayco/billing/${encodeURIComponent(input.invoiceId)}`;

    return {
      ok: true,
      message: "Checkout ePayco listo",
      checkoutUrl,
      reference: input.reference,
    };
  }
}

export const epaycoAdapter = new EpaycoPaymentAdapter();
