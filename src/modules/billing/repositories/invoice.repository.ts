import { PaymentInvoiceLedgerStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TENANT_SINGLETON } from "@/modules/billing/domain/constants";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
} from "@/modules/billing/lib/billing-schema-guard";

export async function findPaymentInvoiceByBillingInvoiceId(billingInvoiceId: string) {
  if (!hasPaymentLedgerDelegates()) return null;
  try {
    return await db.paymentInvoice.findFirst({
      where: { billingInvoiceId },
      include: { transactions: true, attempts: true },
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return null;
    throw error;
  }
}

export async function createPaymentInvoice(data: Prisma.PaymentInvoiceCreateInput) {
  return db.paymentInvoice.create({ data });
}

export async function updatePaymentInvoiceStatus(
  id: string,
  status: PaymentInvoiceLedgerStatus,
  paidAt?: Date | null,
) {
  return db.paymentInvoice.update({
    where: { id },
    data: { status, paidAt: paidAt ?? undefined },
  });
}

export async function listPaymentInvoices(limit = 30) {
  if (!hasPaymentLedgerDelegates()) return [];
  try {
    return await db.paymentInvoice.findMany({
      where: { tenantId: TENANT_SINGLETON },
      orderBy: { dueAt: "desc" },
      take: limit,
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return [];
    throw error;
  }
}
