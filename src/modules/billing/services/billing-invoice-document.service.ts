import type { BillingInvoice, BillingPlanCode } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BILLING_ACCOUNT_SINGLETON } from "@/modules/billing/domain/constants";
import { BANK_TRANSFER_DETAILS } from "@/modules/billing/domain/bank-transfer";
import {
  buildInvoiceNumber,
  formatInvoicePeriod,
  splitTaxIncludedTotal,
  type BillingInvoiceDocument,
} from "@/modules/billing/domain/invoice-document";
import { getPlanDefinition } from "@/modules/billing/domain/plan-catalog";
import type { BillingReceiptPaymentMethod } from "@/modules/billing/services/billing-receipt-email.service";

function paymentMethodLabel(method: BillingReceiptPaymentMethod) {
  return method === "bank_transfer" ? "Transferencia bancaria" : "Pago en línea (Wompi)";
}

function resolveCustomerName(input: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}) {
  const person = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  if (input.companyName?.trim()) {
    return person
      ? `${input.companyName.trim()} (${person})`
      : input.companyName.trim();
  }
  return person || "Cliente PRAGMA";
}

function resolvePaymentMeta(invoice: BillingInvoice): {
  method: BillingReceiptPaymentMethod;
  reference: string | null;
} {
  if (invoice.manualPaymentRef) {
    return { method: "bank_transfer", reference: invoice.manualPaymentRef };
  }
  return {
    method: "online",
    reference:
      invoice.wompiTransactionId ?? invoice.externalRef ?? null,
  };
}

function buildDocumentFromParts(input: {
  invoice: BillingInvoice;
  plan: BillingPlanCode;
  periodStart: Date;
  periodEnd: Date;
  customer: {
    displayName: string;
    companyName: string | null;
    email: string;
  };
  isPreview: boolean;
}): BillingInvoiceDocument {
  const planDef = getPlanDefinition(input.plan);
  const total = Number(input.invoice.amount);
  const { subtotal, taxAmount } = splitTaxIncludedTotal(total);
  const periodLabel = formatInvoicePeriod(input.periodStart, input.periodEnd);
  const payment = resolvePaymentMeta(input.invoice);
  const paid = input.invoice.status === "PAID";

  return {
    invoiceNumber: buildInvoiceNumber(input.invoice.id),
    issueDate: input.invoice.createdAt,
    dueAt: input.invoice.dueAt,
    paidAt: input.invoice.paidAt,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    isPreview: input.isPreview,
    issuer: {
      legalName: BANK_TRANSFER_DETAILS.accountHolder,
      nit: BANK_TRANSFER_DETAILS.nit,
      email: BANK_TRANSFER_DETAILS.email,
      address: process.env.PRAGMA_LEGAL_ADDRESS?.trim() || "Colombia",
    },
    customer: input.customer,
    lineItems: [
      {
        description: `Suscripción ${planDef.name} — Software PMS (${periodLabel})`,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal,
      },
    ],
    subtotal,
    taxRate: 0.19,
    taxAmount,
    total,
    currency: input.invoice.currency,
    plan: {
      code: planDef.code,
      name: planDef.name,
      features: planDef.features,
    },
    paymentMethod: paid ? paymentMethodLabel(payment.method) : "Pendiente de pago",
    paymentReference: paid ? payment.reference : null,
    statusLabel: paid
      ? input.isPreview
        ? "COMPROBANTE DE PAGO"
        : "FACTURA PAGADA"
      : "VISTA PREVIA — NO VALIDA COMO FACTURA FISCAL",
  };
}

async function resolveBillingCustomer() {
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", isActive: true, isAccountOwner: true },
    orderBy: { createdAt: "asc" },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      companyName: true,
    },
  });

  if (admin) {
    return {
      displayName: resolveCustomerName(admin),
      companyName: admin.companyName,
      email: admin.email,
    };
  }

  const fallback = await db.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      companyName: true,
    },
  });

  if (fallback) {
    return {
      displayName: resolveCustomerName(fallback),
      companyName: fallback.companyName,
      email: fallback.email,
    };
  }

  const email =
    process.env.PRAGMA_BILLING_EMAIL?.trim() ?? "cliente@pragma.co";

  return {
    displayName: "Cliente PRAGMA",
    companyName: null,
    email,
  };
}

export async function getBillingInvoiceDocument(
  invoiceId: string,
): Promise<BillingInvoiceDocument | null> {
  const [invoice, account, customer] = await Promise.all([
    db.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        billingAccountId: BILLING_ACCOUNT_SINGLETON,
        status: "PAID",
      },
    }),
    db.billingAccount.findUnique({ where: { id: BILLING_ACCOUNT_SINGLETON } }),
    resolveBillingCustomer(),
  ]);

  if (!invoice) return null;

  const paidAt = invoice.paidAt ?? new Date();
  const periodEnd =
    account?.currentPeriodEnd ??
    new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  return buildDocumentFromParts({
    invoice,
    plan: account?.plan ?? "STARTER",
    periodStart: paidAt,
    periodEnd,
    customer,
    isPreview: false,
  });
}

/** Factura del plan actual: última pagada o vista previa desde la cuenta activa. */
export async function getCurrentPlanInvoiceDocument(): Promise<BillingInvoiceDocument | null> {
  const [account, customer, latestPaid] = await Promise.all([
    db.billingAccount.findUnique({ where: { id: BILLING_ACCOUNT_SINGLETON } }),
    resolveBillingCustomer(),
    db.billingInvoice.findFirst({
      where: {
        billingAccountId: BILLING_ACCOUNT_SINGLETON,
        status: "PAID",
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  if (!account) return null;

  if (latestPaid) {
    const paidAt = latestPaid.paidAt ?? new Date();
    const periodEnd =
      account.currentPeriodEnd ??
      new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return buildDocumentFromParts({
      invoice: latestPaid,
      plan: account.plan,
      periodStart: paidAt,
      periodEnd,
      customer,
      isPreview: false,
    });
  }

  const now = new Date();
  const periodEnd =
    account.currentPeriodEnd ??
    new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const planDef = getPlanDefinition(account.plan);

  const previewInvoice: BillingInvoice = {
    id: "clpreview00000001",
    billingAccountId: BILLING_ACCOUNT_SINGLETON,
    amount: new Prisma.Decimal(planDef.monthlyAmountCop),
    currency: planDef.currency,
    status: "PAID",
    description: `Suscripción ${planDef.name} — PRAGMA PMS`,
    dueAt: now,
    paidAt: now,
    externalRef: null,
    wompiTransactionId: null,
    failureReason: null,
    manualPaymentRef: null,
    manualPaymentNote: null,
    manualSubmittedAt: null,
    invoiceEmailSentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  return buildDocumentFromParts({
    invoice: previewInvoice,
    plan: account.plan,
    periodStart: now,
    periodEnd,
    customer,
    isPreview: true,
  });
}
