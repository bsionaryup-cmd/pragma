import type { PaymentMethodType, PaymentTransactionStatus } from "@prisma/client";
import type { PaymentTransactionStatusValue } from "@/modules/billing/domain/payment-transaction-status";
import { assertWompiConfigured } from "@/modules/billing/config/wompi.config";
import type {
  PaymentProviderCheckoutInput,
  PaymentProviderCheckoutResult,
  WompiWebhookEvent,
} from "@/modules/billing/domain/types";
import type { PaymentProviderAdapter } from "@/modules/billing/providers/payment-provider";
import { verifyWompiEventChecksum } from "@/modules/billing/providers/wompi/wompi.signature";
import { resolveWompiConfig } from "@/modules/billing/services/wompi-credentials";

const WOMPI_STATUS_MAP: Record<string, PaymentTransactionStatusValue> = {
  APPROVED: "APPROVED",
  APPROVED_PARTIAL: "APPROVED",
  DECLINED: "DECLINED",
  ERROR: "FAILED",
  PENDING: "PENDING",
  VOIDED: "CANCELLED",
};

function mapPaymentMethod(type?: string): PaymentMethodType {
  const n = type?.toUpperCase() ?? "";
  if (n.includes("PSE")) return "PSE";
  if (n.includes("NEQUI")) return "NEQUI";
  if (n.includes("CARD") || n.includes("CREDIT") || n.includes("DEBIT")) {
    return "CARD";
  }
  if (n.includes("TRANSFER")) return "TRANSFER";
  return "OTHER";
}

export class WompiPaymentAdapter implements PaymentProviderAdapter {
  readonly code = "WOMPI" as const;

  isConfigured(): boolean {
    return false;
  }

  async createCheckout(
    input: PaymentProviderCheckoutInput,
  ): Promise<PaymentProviderCheckoutResult> {
    const config = await assertWompiConfigured();

    try {
      const response = await fetch(`${config.baseUrl}/payment_links`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.privateKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Suscripción PRAGMA PMS",
          description: `Factura ${input.invoiceId}`,
          single_use: true,
          collect_shipping: false,
          currency: input.currency,
          amount_in_cents: input.amountInCents,
          reference: input.reference,
          redirect_url: input.redirectUrl,
          customer_data: { email: input.customerEmail },
        }),
      });

      const payload = (await response.json()) as {
        data?: { id?: string; permalink?: string };
        error?: { reason?: string };
      };

      if (!response.ok) {
        return {
          ok: false,
          message: payload.error?.reason ?? "Wompi rechazó la solicitud de pago",
        };
      }

      return {
        ok: true,
        message: "Enlace de pago generado",
        checkoutUrl:
          payload.data?.permalink ??
          `https://checkout.wompi.co/l/${payload.data?.id}`,
        reference: input.reference,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al contactar Wompi",
      };
    }
  }

  verifyWebhookSignature(_input: { rawBody: string; signature: string }): boolean {
    return false;
  }

  async verifyWebhookSignatureAsync(input: {
    rawBody: string;
    signature: string;
  }): Promise<boolean> {
    const secret = (await resolveWompiConfig()).eventsSecret;
    if (!secret) return false;
    return verifyWompiEventChecksum({
      payload: input.rawBody,
      signature: input.signature,
      secret,
    });
  }

  parseWebhookEvent(rawBody: string): WompiWebhookEvent {
    return JSON.parse(rawBody) as WompiWebhookEvent;
  }

  mapProviderStatus(status: string): PaymentTransactionStatus {
    return (WOMPI_STATUS_MAP[status.toUpperCase()] ??
      "PENDING") as PaymentTransactionStatus;
  }

  mapPaymentMethodType(type?: string): PaymentMethodType {
    return mapPaymentMethod(type);
  }
}

export const wompiAdapter = new WompiPaymentAdapter();
