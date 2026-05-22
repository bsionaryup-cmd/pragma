import { PaymentProviderCode, PaymentRefundStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { TENANT_SINGLETON } from "@/modules/billing/domain/constants";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
} from "@/modules/billing/lib/billing-schema-guard";

export async function createRefundPlaceholder(input: {
  invoiceId: string;
  transactionId: string;
  amount: number;
  currency?: string;
  reason?: string;
  actorId?: string;
}) {
  return db.paymentRefund.create({
    data: {
      tenantId: TENANT_SINGLETON,
      invoiceId: input.invoiceId,
      transactionId: input.transactionId,
      amount: input.amount,
      currency: input.currency ?? "COP",
      status: PaymentRefundStatus.PENDING,
      provider: PaymentProviderCode.WOMPI,
      reason: input.reason ?? "Reembolso pendiente (integración PSP)",
      metadata: { actorId: input.actorId ?? null, placeholder: true },
    },
  });
}

export async function countRefunds() {
  if (!hasPaymentLedgerDelegates()) return 0;
  try {
    return await db.paymentRefund.count({
      where: { tenantId: TENANT_SINGLETON },
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return 0;
    throw error;
  }
}
