import { createHash } from "crypto";
import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";

const SINGLETON_ID = "singleton";

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

function wompiBaseUrl(): string {
  const env = process.env.WOMPI_ENV?.trim() || "test";
  return env === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

export async function createWompiCheckout(
  input: WompiCheckoutInput,
): Promise<WompiCheckoutResult> {
  const publicKey = process.env.WOMPI_PUBLIC_KEY?.trim();
  const privateKey = process.env.WOMPI_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    return {
      ok: false,
      message: "Configura WOMPI_PUBLIC_KEY y WOMPI_PRIVATE_KEY en el servidor",
    };
  }

  const reference = `pragma-${input.invoiceId}-${Date.now()}`;
  const currency = input.currency ?? "COP";

  try {
    const response = await fetch(`${wompiBaseUrl()}/payment_links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${privateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Suscripción PRAGMA PMS",
        description: `Factura ${input.invoiceId}`,
        single_use: true,
        collect_shipping: false,
        currency,
        amount_in_cents: input.amountInCents,
        reference,
        redirect_url: input.redirectUrl,
        customer_data: {
          email: input.customerEmail,
        },
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

    const checkoutUrl =
      payload.data?.permalink ??
      `https://checkout.wompi.co/l/${payload.data?.id}`;

    await db.billingInvoice.update({
      where: { id: input.invoiceId },
      data: { externalRef: reference },
    });

    return { ok: true, message: "Enlace de pago generado", checkoutUrl, reference };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al contactar Wompi",
    };
  }
}

export function verifyWompiEventChecksum(input: {
  payload: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = createHash("sha256")
    .update(`${input.payload}${input.secret}`)
    .digest("hex");
  return expected === input.signature;
}

export async function reconcileWompiTransactionEvent(event: {
  event: string;
  data?: {
    transaction?: {
      id?: string;
      status?: string;
      reference?: string;
      amount_in_cents?: number;
    };
  };
}): Promise<{ ok: boolean; message: string }> {
  const reference = event.data?.transaction?.reference;
  const status = event.data?.transaction?.status?.toUpperCase();
  const transactionId = event.data?.transaction?.id;

  if (!reference) {
    return { ok: false, message: "Evento sin referencia" };
  }

  const invoice = await db.billingInvoice.findFirst({
    where: { externalRef: reference },
  });

  if (!invoice) {
    return { ok: true, message: "Referencia desconocida (idempotente)" };
  }

  if (status === "APPROVED" || status === "APPROVED_PARTIAL") {
    if (invoice.status === BillingInvoiceStatus.PAID) {
      return { ok: true, message: "Factura ya pagada (idempotente)" };
    }
    await db.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: BillingInvoiceStatus.PAID,
        paidAt: new Date(),
        wompiTransactionId: transactionId ?? null,
        failureReason: null,
      },
    });

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await db.billingAccount.update({
      where: { id: SINGLETON_ID },
      data: {
        status: BillingSubscriptionStatus.ACTIVE,
        billingLockedAt: null,
        gracePeriodEndsAt: null,
        currentPeriodEnd: periodEnd,
      },
    });

    return { ok: true, message: "Pago reconciliado" };
  }

  if (status === "DECLINED" || status === "ERROR") {
    await db.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: BillingInvoiceStatus.FAILED,
        failureReason: status,
        wompiTransactionId: transactionId ?? null,
      },
    });
    return { ok: true, message: "Pago fallido registrado" };
  }

  return { ok: true, message: "Evento ignorado" };
}
