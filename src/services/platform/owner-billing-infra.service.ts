import {
  BillingInvoiceStatus,
  PaymentProviderCode,
  PaymentTransactionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { hasPaymentLedgerDelegates } from "@/modules/billing/lib/billing-schema-guard";
import { getPlatformWompiCredentialSnapshot } from "@/modules/billing/services/wompi-credentials";
import type { WompiCredentialSnapshot } from "@/modules/billing/services/wompi-credentials";
import { getPlatformEpaycoCredentialSnapshot } from "@/modules/integrations/epayco/epayco-credentials";
import type { EpaycoCredentialSnapshot } from "@/modules/integrations/epayco/epayco-credentials";
import { PLATFORM_EPAYCO_ORG_NAME } from "@/modules/billing/services/epayco-platform.service";

const PLATFORM_WOMPI_ORG_NAME = "PRAGMA Platform (Wompi)";

export type OwnerWebhookLogRow = {
  id: string;
  eventType: string;
  eventId: string;
  signatureValid: boolean;
  duplicate: boolean;
  processed: boolean;
  errorMessage: string | null;
  createdAt: string;
};

export type OwnerFailedPaymentRow = {
  invoiceId: string;
  organizationId: string | null;
  organizationName: string | null;
  amount: number;
  currency: string;
  status: string;
  failureReason: string | null;
  dueAt: string;
  updatedAt: string;
  wompiTransactionId: string | null;
};

export type OwnerBillingInfraSnapshot = {
  wompi: WompiCredentialSnapshot;
  epayco: EpaycoCredentialSnapshot;
  webhookStats: {
    total24h: number;
    invalidSignature24h: number;
    unprocessed24h: number;
    duplicate24h: number;
  };
  failedPayments: OwnerFailedPaymentRow[];
  recentWebhooks: OwnerWebhookLogRow[];
};

export async function getOwnerBillingInfraSnapshot(): Promise<OwnerBillingInfraSnapshot> {
  const [wompi, epayco] = await Promise.all([
    getPlatformWompiCredentialSnapshot(),
    getPlatformEpaycoCredentialSnapshot(),
  ]);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [failedPayments, recentWebhooks, webhookStats] = await Promise.all([
    listFailedSubscriptionPayments(30),
    listRecentWebhookLogs(40),
    aggregateWebhookStats(since24h),
  ]);

  return {
    wompi,
    epayco,
    webhookStats,
    failedPayments,
    recentWebhooks,
  };
}

async function listFailedSubscriptionPayments(
  limit: number,
): Promise<OwnerFailedPaymentRow[]> {
  const rows = await db.billingInvoice.findMany({
    where: {
      OR: [
        { status: BillingInvoiceStatus.FAILED },
        {
          status: BillingInvoiceStatus.OPEN,
          dueAt: { lt: new Date() },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      account: {
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return rows
    .filter(
      (row) =>
        row.account.organization?.name !== PLATFORM_WOMPI_ORG_NAME &&
        row.account.organization?.name !== PLATFORM_EPAYCO_ORG_NAME,
    )
    .map((row) => ({
      invoiceId: row.id,
      organizationId: row.account.organizationId,
      organizationName: row.account.organization?.name ?? null,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      failureReason: row.failureReason,
      dueAt: row.dueAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      wompiTransactionId: row.wompiTransactionId,
    }));
}

async function listRecentWebhookLogs(limit: number): Promise<OwnerWebhookLogRow[]> {
  if (!hasPaymentLedgerDelegates()) return [];

  const rows = await db.paymentWebhookLog.findMany({
    where: { provider: PaymentProviderCode.WOMPI },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    eventId: row.eventId,
    signatureValid: row.signatureValid,
    duplicate: row.duplicate,
    processed: row.processed,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function aggregateWebhookStats(since: Date) {
  if (!hasPaymentLedgerDelegates()) {
    return {
      total24h: 0,
      invalidSignature24h: 0,
      unprocessed24h: 0,
      duplicate24h: 0,
    };
  }

  const [total24h, invalidSignature24h, unprocessed24h, duplicate24h] =
    await Promise.all([
      db.paymentWebhookLog.count({
        where: { provider: PaymentProviderCode.WOMPI, createdAt: { gte: since } },
      }),
      db.paymentWebhookLog.count({
        where: {
          provider: PaymentProviderCode.WOMPI,
          createdAt: { gte: since },
          signatureValid: false,
        },
      }),
      db.paymentWebhookLog.count({
        where: {
          provider: PaymentProviderCode.WOMPI,
          createdAt: { gte: since },
          processed: false,
        },
      }),
      db.paymentWebhookLog.count({
        where: {
          provider: PaymentProviderCode.WOMPI,
          createdAt: { gte: since },
          duplicate: true,
        },
      }),
    ]);

  return { total24h, invalidSignature24h, unprocessed24h, duplicate24h };
}

export async function listOwnerFailedTransactions(limit = 50) {
  if (!hasPaymentLedgerDelegates()) return [];

  return db.paymentTransaction.findMany({
    where: {
      provider: PaymentProviderCode.WOMPI,
      status: {
        in: [PaymentTransactionStatus.FAILED, PaymentTransactionStatus.DECLINED],
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      invoice: {
        include: {
          billingInvoice: {
            include: {
              account: {
                include: {
                  organization: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}
