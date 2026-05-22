import {
  PaymentMethodType,
  PaymentProviderCode,
  PaymentTransactionStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { TENANT_SINGLETON } from "@/modules/billing/domain/constants";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
} from "@/modules/billing/lib/billing-schema-guard";

export async function findTransactionByProviderReference(
  provider: PaymentProviderCode,
  providerReference: string,
) {
  if (!hasPaymentLedgerDelegates()) return null;
  try {
    return await db.paymentTransaction.findFirst({
      where: { provider, providerReference },
      include: { invoice: true },
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return null;
    throw error;
  }
}

export async function findTransactionByIdempotencyKey(idempotencyKey: string) {
  if (!hasPaymentLedgerDelegates()) return null;
  try {
    return await db.paymentTransaction.findUnique({
      where: { idempotencyKey },
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return null;
    throw error;
  }
}

export async function createTransaction(data: Prisma.PaymentTransactionCreateInput) {
  return db.paymentTransaction.create({ data });
}

export async function updateTransactionStatus(
  id: string,
  input: {
    status: PaymentTransactionStatus;
    providerReference?: string;
    paymentMethod?: PaymentMethodType;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return db.paymentTransaction.update({
    where: { id },
    data: {
      status: input.status,
      providerReference: input.providerReference,
      paymentMethod: input.paymentMethod,
      metadata: input.metadata,
    },
  });
}

export async function listTransactions(input: {
  status?: PaymentTransactionStatus;
  search?: string;
  limit?: number;
}) {
  if (!hasPaymentLedgerDelegates()) return [];
  try {
    const where: Prisma.PaymentTransactionWhereInput = {
      tenantId: TENANT_SINGLETON,
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              {
                providerReference: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              { id: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return await db.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return [];
    throw error;
  }
}

export async function aggregateTransactionMetrics() {
  if (!hasPaymentLedgerDelegates()) return [];
  try {
    return await db.paymentTransaction.groupBy({
      by: ["status"],
      where: { tenantId: TENANT_SINGLETON },
      _count: { _all: true },
      _sum: { amount: true, fees: true },
    });
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return [];
    throw error;
  }
}
