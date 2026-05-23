"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { assertWompiConfigured } from "@/modules/billing/config/wompi.config";
import { PaymentProviderNotConfiguredError } from "@/modules/billing/domain/errors";
import { prepareBillingInvoiceForPayment } from "@/modules/billing/services/billing-invoice.service";
import type { BillingPlanCode } from "@prisma/client";
import {
  confirmManualPayment,
  selectSubscriptionPlan,
  submitManualPaymentProof,
} from "@/modules/billing/services/manual-payment.service";
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
  const user = await requirePermission("billing:manage");

  try {
    await assertWompiConfigured();
  } catch (error) {
    if (error instanceof PaymentProviderNotConfiguredError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  const invoice = await prepareBillingInvoiceForPayment(invoiceId);
  if (!invoice) {
    return {
      ok: false,
      message: "Factura no disponible para pago (debe estar abierta o reintentable)",
    };
  }

  const amount = Number(invoice.amount);
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
    currency: invoice.currency ?? "COP",
    customerEmail: user.email,
    redirectUrl: `${origin}/settings/billing?paid=1`,
  });

  if (!result.ok) return result;
  revalidateBilling();
  return result;
}

export async function selectPlanAction(plan: BillingPlanCode, propertyCount: number) {
  const user = await requirePermission("billing:manage");
  const result = await selectSubscriptionPlan({
    plan,
    propertyCount,
    actorId: user.dbUserId,
  });
  revalidateBilling();
  return result;
}

export async function submitManualPaymentAction(input: {
  invoiceId: string;
  reference: string;
  note?: string;
}) {
  const user = await requirePermission("billing:manage");
  const result = await submitManualPaymentProof({
    ...input,
    actorId: user.dbUserId,
  });
  revalidateBilling();
  return result;
}

export async function confirmManualPaymentAction(invoiceId: string) {
  const user = await requirePermission("billing:manage");
  const result = await confirmManualPayment({
    invoiceId,
    actorId: user.dbUserId,
  });
  revalidateBilling();
  return result;
}

export async function getSubscriptionStatusAction() {
  await requirePermission("billing:manage");
  const overview = await getBillingOverview();
  return {
    status: overview.account.status,
    locked: overview.access.locked,
  };
}

/** Dev / manual activation when online payment is not configured */
export async function activateSubscriptionManualAction() {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, message: "Activación manual no disponible en producción" };
  }
  await requirePermission("billing:manage");
  const result = await activateBillingSubscription();
  revalidateBilling();
  return result;
}
