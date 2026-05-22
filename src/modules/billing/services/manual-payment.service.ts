import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  type BillingPlanCode,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requireBillingAccountId } from "@/lib/billing/resolve-billing-account";
import { getPlanMonthlyAmount } from "@/modules/billing/domain/plan-catalog";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";
import { queueBillingReceiptEmail } from "@/modules/billing/services/billing-receipt-email.service";

export async function selectSubscriptionPlan(input: {
  plan: BillingPlanCode;
  actorId: string;
}): Promise<{ ok: boolean; message: string }> {
  const billingAccountId = await requireBillingAccountId();
  const amount = getPlanMonthlyAmount(input.plan);

  await db.billingAccount.update({
    where: { id: billingAccountId },
    data: { plan: input.plan },
  });

  await db.billingInvoice.updateMany({
    where: {
      billingAccountId,
      status: BillingInvoiceStatus.OPEN,
    },
    data: { amount },
  });

  await writePaymentAuditLog({
    entityType: "billing_account",
    entityId: billingAccountId,
    action: "plan_selected",
    actorId: input.actorId,
    after: { plan: input.plan, amount },
  });

  return { ok: true, message: `Plan ${input.plan} seleccionado` };
}

export async function submitManualPaymentProof(input: {
  invoiceId: string;
  reference: string;
  note?: string;
  actorId: string;
}): Promise<{ ok: boolean; message: string }> {
  const billingAccountId = await requireBillingAccountId();
  const reference = input.reference.trim();
  if (reference.length < 4) {
    return { ok: false, message: "Indica la referencia de la transferencia" };
  }

  const invoice = await db.billingInvoice.findFirst({
    where: {
      id: input.invoiceId,
      billingAccountId,
      status: { in: [BillingInvoiceStatus.OPEN, BillingInvoiceStatus.FAILED] },
    },
  });

  if (!invoice) {
    return { ok: false, message: "Factura no disponible para comprobante" };
  }

  await db.billingInvoice.update({
    where: { id: invoice.id },
    data: {
      manualPaymentRef: reference,
      manualPaymentNote: input.note?.trim() || null,
      manualSubmittedAt: new Date(),
      status: BillingInvoiceStatus.OPEN,
    },
  });

  await writePaymentAuditLog({
    entityType: "billing_invoice",
    entityId: invoice.id,
    action: "manual_payment_submitted",
    actorId: input.actorId,
    after: { reference },
  });

  return {
    ok: true,
    message: "Comprobante registrado. Verificaremos el pago en 1–2 días hábiles.",
  };
}

export async function confirmManualPayment(input: {
  invoiceId: string;
  actorId: string;
  note?: string;
}): Promise<{ ok: boolean; message: string }> {
  const billingAccountId = await requireBillingAccountId();
  const invoice = await db.billingInvoice.findFirst({
    where: {
      id: input.invoiceId,
      billingAccountId,
    },
  });

  if (!invoice) {
    return { ok: false, message: "Factura no encontrada" };
  }

  if (invoice.status === BillingInvoiceStatus.PAID) {
    return { ok: true, message: "Factura ya estaba pagada" };
  }

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.billingInvoice.update({
    where: { id: invoice.id },
    data: {
      status: BillingInvoiceStatus.PAID,
      paidAt: new Date(),
      failureReason: null,
      manualPaymentNote: input.note?.trim() || invoice.manualPaymentNote,
    },
  });

  await db.billingAccount.update({
    where: { id: billingAccountId },
    data: {
      status: BillingSubscriptionStatus.ACTIVE,
      billingLockedAt: null,
      gracePeriodEndsAt: null,
      currentPeriodEnd: periodEnd,
    },
  });

  await writePaymentAuditLog({
    entityType: "billing_invoice",
    entityId: invoice.id,
    action: "manual_payment_confirmed",
    actorId: input.actorId,
    after: { reference: invoice.manualPaymentRef },
  });

  queueBillingReceiptEmail({
    invoiceId: invoice.id,
    paymentMethod: "bank_transfer",
    paymentReference: invoice.manualPaymentRef,
  });

  return { ok: true, message: "Pago manual confirmado. Suscripción activada." };
}
