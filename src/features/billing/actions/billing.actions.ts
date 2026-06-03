"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { isSubscriptionPaymentAvailable } from "@/modules/billing/services/subscription-payment-gateway.service";
import { prepareBillingInvoiceForPayment } from "@/modules/billing/services/billing-invoice.service";
import type { BillingPlanCode } from "@prisma/client";
import {
  confirmManualPayment,
  selectSubscriptionPlan,
  submitManualPaymentProof,
} from "@/modules/billing/services/manual-payment.service";
import { requireBillingAccountId } from "@/lib/billing/resolve-billing-account";
import { cancelOrganizationSubscription } from "@/modules/billing/services/subscription-cancel.service";
import {
  activateBillingSubscription,
  getBillingOverview,
} from "@/services/billing/billing.service";
import { getPublicAppUrl } from "@/lib/app-url";
import { createSubscriptionCheckout } from "@/services/billing/wompi.service";

function revalidateBilling() {
  revalidatePath("/settings/billing");
  revalidatePath("/panel");
  revalidatePath("/revenue");
}

export async function payOpenInvoiceAction(invoiceId: string) {
  const user = await requirePermission("billing:manage");

  if (!(await isSubscriptionPaymentAvailable())) {
    return {
      ok: false,
      message: "Ninguna pasarela configurada (Wompi o ePayco en Owner Dashboard)",
    };
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

  const origin = getPublicAppUrl();

  const result = await createSubscriptionCheckout({
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

export async function cancelSubscriptionAction() {
  const user = await requirePermission("billing:manage");
  const billingAccountId = await requireBillingAccountId();
  const result = await cancelOrganizationSubscription({
    billingAccountId,
    actorId: user.dbUserId,
  });
  revalidateBilling();
  revalidatePath("/owner-dashboard");
  return result;
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
