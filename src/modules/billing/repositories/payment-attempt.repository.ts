import { PaymentProviderCode, PaymentTransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { TENANT_SINGLETON } from "@/modules/billing/domain/constants";
import { hasPaymentLedgerDelegates } from "@/modules/billing/lib/billing-schema-guard";

export async function getNextAttemptNumber(invoiceId: string): Promise<number> {
  if (!hasPaymentLedgerDelegates()) return 1;
  const last = await db.paymentAttempt.findFirst({
    where: { invoiceId },
    orderBy: { attemptNumber: "desc" },
    select: { attemptNumber: true },
  });
  return (last?.attemptNumber ?? 0) + 1;
}

export async function createPaymentAttempt(input: {
  invoiceId: string;
  transactionId?: string;
  amount: number;
  currency: string;
  provider?: PaymentProviderCode;
  status?: PaymentTransactionStatus;
  metadata?: object;
}) {
  const attemptNumber = await getNextAttemptNumber(input.invoiceId);
  return db.paymentAttempt.create({
    data: {
      tenantId: TENANT_SINGLETON,
      invoiceId: input.invoiceId,
      transactionId: input.transactionId ?? null,
      attemptNumber,
      provider: input.provider ?? PaymentProviderCode.WOMPI,
      status: input.status ?? PaymentTransactionStatus.PENDING,
      amount: input.amount,
      currency: input.currency,
      metadata: input.metadata,
    },
  });
}
