import type { PaymentProviderCheckoutInput, PaymentProviderCheckoutResult } from "@/modules/billing/domain/types";
import type { PaymentProviderAdapter } from "@/modules/billing/providers/payment-provider";
import { isPlatformEpaycoConfigured } from "@/modules/integrations/epayco/epayco-credentials";

function resolveAppOrigin(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!base) return "http://localhost:3000";
  return base.startsWith("http") ? base.replace(/\/$/, "") : `https://${base}`;
}

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

    const checkoutUrl = `${resolveAppOrigin()}/pay/epayco/billing/${encodeURIComponent(input.invoiceId)}`;

    return {
      ok: true,
      message: "Checkout ePayco listo",
      checkoutUrl,
      reference: input.reference,
    };
  }
}

export const epaycoAdapter = new EpaycoPaymentAdapter();
