"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  activateBillingSubscription,
  getBillingOverview,
} from "@/services/billing/billing.service";
import { createWompiCheckout } from "@/services/billing/wompi.service";

function revalidateBilling() {
  revalidatePath("/settings/billing");
  revalidatePath("/panel");
  revalidatePath("/revenue");
}

export async function payOpenInvoiceAction(invoiceId: string) {
  const user = await requireRole("ADMIN");
  const overview = await getBillingOverview();
  const invoice = overview.invoices.find((i) => i.id === invoiceId);
  if (!invoice || invoice.status !== "OPEN") {
    return { ok: false, message: "Factura no disponible para pago" };
  }

  const amount = Number.parseFloat(invoice.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Monto de factura inválido" };
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000";
  const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

  const result = await createWompiCheckout({
    invoiceId,
    amountInCents: Math.round(amount * 100),
    currency: invoice.currency,
    customerEmail: user.email,
    redirectUrl: `${origin}/settings/billing?paid=1`,
  });

  if (!result.ok) return result;
  revalidateBilling();
  return result;
}

/** Dev / manual activation when Wompi keys are not configured */
export async function activateSubscriptionManualAction() {
  await requireRole("ADMIN");
  const result = await activateBillingSubscription();
  revalidateBilling();
  return result;
}
