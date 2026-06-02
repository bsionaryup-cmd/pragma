/**
 * Facade legacy — implementación en `@/modules/billing`.
 */
import { PaymentTransactionStatus } from "@prisma/client";
import { verifyWompiEventChecksum } from "@/modules/billing/providers/wompi/wompi.signature";
import { wompiAdapter } from "@/modules/billing/providers/wompi/wompi.adapter";
import {
  initiateSubscriptionPayment,
  reconcileTransactionFromWebhook,
} from "@/modules/billing/services/payment.service";
import { processWompiWebhook } from "@/modules/billing/services/webhook.service";

export type WompiCheckoutInput = {
  invoiceId: string;
  amountInCents: number;
  currency?: string;
  customerEmail: string;
  redirectUrl: string;
};

export type WompiCheckoutResult = {
  ok: boolean;
  message: string;
  checkoutUrl?: string;
  reference?: string;
};

export { verifyWompiEventChecksum, processWompiWebhook };

export async function createSubscriptionCheckout(
  input: WompiCheckoutInput,
): Promise<WompiCheckoutResult> {
  const result = await initiateSubscriptionPayment({
    billingInvoiceId: input.invoiceId,
    amountInCents: input.amountInCents,
    currency: input.currency ?? "COP",
    customerEmail: input.customerEmail,
    redirectUrl: input.redirectUrl,
  });
  return {
    ok: result.ok,
    message: result.message,
    checkoutUrl: result.ok && "checkoutUrl" in result ? result.checkoutUrl : undefined,
    reference: "reference" in result ? result.reference : undefined,
  };
}

export async function createWompiCheckout(
  input: WompiCheckoutInput,
): Promise<WompiCheckoutResult> {
  return createSubscriptionCheckout(input);
}

export async function reconcileWompiTransactionEvent(event: {
  event: string;
  data?: {
    transaction?: {
      id?: string;
      status?: string;
      reference?: string;
      amount_in_cents?: number;
      payment_method_type?: string;
    };
  };
}): Promise<{ ok: boolean; message: string }> {
  const reference = event.data?.transaction?.reference;
  const status = event.data?.transaction?.status ?? "";
  if (!reference) return { ok: false, message: "Evento sin referencia" };

  return reconcileTransactionFromWebhook({
    reference,
    providerTransactionId: event.data?.transaction?.id,
    status: wompiAdapter.mapProviderStatus(status),
    paymentMethod: wompiAdapter.mapPaymentMethodType(
      event.data?.transaction?.payment_method_type,
    ),
    failureReason:
      wompiAdapter.mapProviderStatus(status) ===
        PaymentTransactionStatus.DECLINED ||
      wompiAdapter.mapProviderStatus(status) === PaymentTransactionStatus.FAILED
        ? status
        : undefined,
  });
}
