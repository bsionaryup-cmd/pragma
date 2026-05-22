import type { PaymentMethodType, PaymentTransactionStatus } from "@prisma/client";
import type {
  PaymentProviderCheckoutInput,
  PaymentProviderCheckoutResult,
  WompiWebhookEvent,
} from "@/modules/billing/domain/types";

export type PaymentProviderCode = "WOMPI" | "STRIPE" | "MERCADOPAGO" | "PAYU" | "MANUAL";

export interface PaymentProviderAdapter {
  readonly code: PaymentProviderCode;
  isConfigured(): boolean;
  createCheckout(input: PaymentProviderCheckoutInput): Promise<PaymentProviderCheckoutResult>;
  verifyWebhookSignature?(input: {
    rawBody: string;
    signature: string;
  }): boolean;
  parseWebhookEvent?(rawBody: string): WompiWebhookEvent;
  mapProviderStatus?(status: string): PaymentTransactionStatus;
  mapPaymentMethodType?(type?: string): PaymentMethodType;
}
