import "server-only";

import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  PaymentProviderCode,
} from "@prisma/client";
import { db } from "@/lib/db";
import { parseBillingSubscriptionReference } from "@/lib/payments/guest-payment-reference";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";
import { queueBillingReceiptEmail } from "@/modules/billing/services/billing-receipt-email.service";

export async function findBillingInvoiceByPaymentReference(reference: string) {
  const trimmed = reference.trim();
  if (!trimmed) return null;

  const invoiceId = parseBillingSubscriptionReference(trimmed);

  return db.billingInvoice.findFirst({
    where: invoiceId
      ? {
          OR: [{ externalRef: trimmed }, { id: invoiceId }],
        }
      : { externalRef: trimmed },
    include: {
      account: {
        select: {
          id: true,
          organizationId: true,
          status: true,
          plan: true,
          billingLockedAt: true,
        },
      },
    },
  });
}

function resolvePeriodEnd(paidAt: Date = new Date()): Date {
  const periodEnd = new Date(paidAt);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  return periodEnd;
}

export async function activateSubscriptionFromPaidInvoice(input: {
  billingInvoiceId: string;
  providerTransactionId?: string | null;
  paymentReference?: string;
  provider?: PaymentProviderCode;
}): Promise<{ activated: boolean; alreadyActive: boolean }> {
  const invoice = await db.billingInvoice.findUnique({
    where: { id: input.billingInvoiceId },
    include: {
      account: true,
    },
  });

  if (!invoice) {
    return { activated: false, alreadyActive: false };
  }

  const account = invoice.account;
  const alreadyActive =
    invoice.status === BillingInvoiceStatus.PAID &&
    account.status === BillingSubscriptionStatus.ACTIVE &&
    !account.billingLockedAt;

  if (alreadyActive) {
    return { activated: false, alreadyActive: true };
  }

  const paidAt = invoice.paidAt ?? new Date();
  const periodEnd = resolvePeriodEnd(paidAt);
  const wasAlreadyPaid = invoice.status === BillingInvoiceStatus.PAID;

  await db.$transaction([
    db.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: BillingInvoiceStatus.PAID,
        paidAt,
        wompiTransactionId: input.providerTransactionId ?? invoice.wompiTransactionId,
        failureReason: null,
        ...(invoice.externalRef
          ? {}
          : {
              externalRef:
                input.paymentReference ??
                (invoice.id ? `pragma-${invoice.id}` : null),
            }),
      },
    }),
    db.billingAccount.update({
      where: { id: account.id },
      data: {
        status: BillingSubscriptionStatus.ACTIVE,
        billingLockedAt: null,
        gracePeriodEndsAt: null,
        currentPeriodEnd: periodEnd,
      },
    }),
  ]);

  if (!wasAlreadyPaid) {
    await writePaymentAuditLog({
      entityType: "billing_invoice",
      entityId: invoice.id,
      action: "payment_approved",
      after: {
        reference: input.paymentReference ?? invoice.externalRef,
        provider: input.provider ?? null,
      },
    });

    queueBillingReceiptEmail({
      invoiceId: invoice.id,
      paymentMethod: "online",
      paymentReference: input.providerTransactionId ?? input.paymentReference ?? undefined,
    });
  }

  return { activated: true, alreadyActive: false };
}
