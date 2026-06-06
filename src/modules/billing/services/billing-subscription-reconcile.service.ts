import "server-only";

import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  PaymentProviderCode,
  PaymentTransactionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { buildBillingSubscriptionReference } from "@/lib/payments/guest-payment-reference";
import { activateSubscriptionFromPaidInvoice } from "@/modules/billing/services/billing-payment-activation.service";
import { updateTransactionStatus } from "@/modules/billing/repositories/transaction.repository";
import { reconcileEpaycoBillingByRefPayco } from "@/modules/billing/services/payment.service";
import { resolveSubscriptionPaymentGateway } from "@/modules/billing/services/subscription-payment-gateway.service";

export async function persistEpaycoRefOnOpenInvoice(input: {
  billingAccountId: string;
  refPayco: string;
  paymentReference?: string | null;
}): Promise<void> {
  const refPayco = input.refPayco.trim();
  if (!refPayco) return;

  const invoice = await db.billingInvoice.findFirst({
    where: {
      billingAccountId: input.billingAccountId,
      status: BillingInvoiceStatus.OPEN,
      ...(input.paymentReference
        ? {
            OR: [
              { externalRef: input.paymentReference },
              {
                id:
                  input.paymentReference.startsWith("pragma-")
                    ? input.paymentReference.slice("pragma-".length)
                    : "__none__",
              },
            ],
          }
        : {}),
    },
    orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, wompiTransactionId: true },
  });

  if (!invoice || invoice.wompiTransactionId === refPayco) return;

  await db.billingInvoice.update({
    where: { id: invoice.id },
    data: { wompiTransactionId: refPayco },
  });
}

async function reconcileOpenInvoiceWithStoredEpaycoRef(
  invoice: {
    id: string;
    externalRef: string | null;
    wompiTransactionId: string | null;
  },
): Promise<boolean> {
  const paymentRef =
    invoice.externalRef ?? buildBillingSubscriptionReference(invoice.id);
  const refPayco = invoice.wompiTransactionId?.trim();
  if (!refPayco) return false;

  return reconcileEpaycoBillingByRefPayco(refPayco, paymentRef);
}

async function repairInterruptedSubscriptionPayment(
  billingAccountId: string,
): Promise<boolean> {
  const account = await db.billingAccount.findUnique({
    where: { id: billingAccountId },
    select: { status: true, currentPeriodEnd: true },
  });

  if (
    !account ||
    account.status !== BillingSubscriptionStatus.ACTIVE ||
    !account.currentPeriodEnd
  ) {
    return false;
  }

  const openInvoice = await db.billingInvoice.findFirst({
    where: {
      billingAccountId,
      status: BillingInvoiceStatus.OPEN,
    },
    orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      externalRef: true,
      wompiTransactionId: true,
    },
  });

  if (!openInvoice) return false;

  const paymentInvoice = await db.paymentInvoice.findFirst({
    where: { billingInvoiceId: openInvoice.id },
    select: { id: true },
  });

  if (!paymentInvoice) return false;

  const pendingTx = await db.paymentTransaction.findFirst({
    where: {
      invoiceId: paymentInvoice.id,
      provider: PaymentProviderCode.EPAYCO,
      status: PaymentTransactionStatus.PENDING,
    },
    select: { id: true, providerReference: true },
  });

  if (!pendingTx) return false;

  const paymentRef =
    openInvoice.externalRef ?? buildBillingSubscriptionReference(openInvoice.id);

  await activateSubscriptionFromPaidInvoice({
    billingInvoiceId: openInvoice.id,
    providerTransactionId:
      openInvoice.wompiTransactionId ?? pendingTx.providerReference ?? undefined,
    paymentReference: paymentRef,
    provider: PaymentProviderCode.EPAYCO,
  });

  await updateTransactionStatus(pendingTx.id, {
    status: PaymentTransactionStatus.APPROVED,
    providerReference:
      openInvoice.wompiTransactionId ?? pendingTx.providerReference ?? undefined,
  });

  return true;
}

/** Reconcilia facturas OPEN pendientes y repara estados inconsistentes tras pago ePayco. */
export async function reconcileOutstandingSubscriptionPayments(
  billingAccountId: string,
): Promise<void> {
  const gateway = await resolveSubscriptionPaymentGateway();
  const openInvoices = await db.billingInvoice.findMany({
    where: {
      billingAccountId,
      status: BillingInvoiceStatus.OPEN,
    },
    orderBy: [{ dueAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      externalRef: true,
      wompiTransactionId: true,
    },
  });

  if (gateway === "EPAYCO") {
    for (const invoice of openInvoices) {
      await reconcileOpenInvoiceWithStoredEpaycoRef(invoice);
    }
  }

  const stillOpen = await db.billingInvoice.count({
    where: { billingAccountId, status: BillingInvoiceStatus.OPEN },
  });

  if (stillOpen > 0) {
    await repairInterruptedSubscriptionPayment(billingAccountId);
  }
}
