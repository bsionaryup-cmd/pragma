import "server-only";

import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  type User,
} from "@prisma/client";
import { db } from "@/lib/db";
import { assertSuperAdminOwner } from "@/lib/platform/platform-owner";
import { ensureOrganizationBillingAccount } from "@/services/organizations/organization.service";
import { SUBSCRIPTION_CURRENCY } from "@/modules/billing/domain/subscription-pricing";
import { resolveSubscriptionAmountForAccount } from "@/modules/billing/domain/subscription-property-count";
import { ensurePaymentInvoiceForBillingInvoice } from "@/modules/billing/services/invoice.service";
import { queueBillingReceiptEmail } from "@/modules/billing/services/billing-receipt-email.service";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";

function resolvePeriodEnd(paidAt = new Date()): Date {
  const periodEnd = new Date(paidAt);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  return periodEnd;
}

async function requireTenantInvoice(organizationId: string, invoiceId: string) {
  const account = await ensureOrganizationBillingAccount(organizationId);
  const invoice = await db.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      billingAccountId: account.id,
    },
  });
  if (!invoice) {
    throw new Error("Factura no encontrada para este cliente");
  }
  return { account, invoice };
}

export async function createTenantInvoiceByOwner(input: {
  platformUser: User;
  organizationId: string;
  amountCop?: number;
  description?: string;
  dueInDays?: number;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const account = await ensureOrganizationBillingAccount(input.organizationId);

  const resolved = await resolveSubscriptionAmountForAccount({
    plan: account.plan,
    organizationId: account.organizationId,
    metadata: account.metadata,
  });

  const amount =
    typeof input.amountCop === "number" && Number.isFinite(input.amountCop)
      ? Math.max(0, Math.round(input.amountCop))
      : resolved.amount;

  if (amount <= 0) {
    throw new Error("El monto de la factura debe ser mayor a 0");
  }

  const dueInDays = Math.max(0, Math.min(90, Math.round(input.dueInDays ?? 3)));
  const description =
    input.description?.trim() ||
    `Suscripción PRAGMA — factura manual · ${resolved.propertyCount} propiedad${
      resolved.propertyCount === 1 ? "" : "es"
    }`;

  const invoice = await db.billingInvoice.create({
    data: {
      billingAccountId: account.id,
      amount,
      currency: SUBSCRIPTION_CURRENCY,
      status: BillingInvoiceStatus.OPEN,
      description,
      dueAt: new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000),
    },
  });

  void ensurePaymentInvoiceForBillingInvoice(invoice.id).catch((err) => {
    console.error("[owner-invoice] payment invoice sync:", err);
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_invoice_create",
    targetTenantId: input.organizationId,
    newState: {
      invoiceId: invoice.id,
      amount,
      description,
      dueAt: invoice.dueAt.toISOString(),
    },
    metadata: { reason: input.reason ?? "owner_ops" },
  });

  return invoice;
}

export async function updateTenantInvoiceByOwner(input: {
  platformUser: User;
  organizationId: string;
  invoiceId: string;
  amountCop?: number;
  description?: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const { invoice } = await requireTenantInvoice(
    input.organizationId,
    input.invoiceId,
  );

  if (
    invoice.status !== BillingInvoiceStatus.OPEN &&
    invoice.status !== BillingInvoiceStatus.FAILED &&
    invoice.status !== BillingInvoiceStatus.DRAFT
  ) {
    throw new Error("Solo se pueden editar facturas abiertas, fallidas o borrador");
  }

  const data: {
    amount?: number;
    description?: string | null;
    status?: BillingInvoiceStatus;
  } = {};

  if (typeof input.amountCop === "number" && Number.isFinite(input.amountCop)) {
    const amount = Math.max(0, Math.round(input.amountCop));
    if (amount <= 0) throw new Error("El monto de la factura debe ser mayor a 0");
    data.amount = amount;
  }

  if (typeof input.description === "string") {
    data.description = input.description.trim() || null;
  }

  if (invoice.status === BillingInvoiceStatus.FAILED && data.amount != null) {
    data.status = BillingInvoiceStatus.OPEN;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No hay cambios para aplicar");
  }

  const updated = await db.billingInvoice.update({
    where: { id: invoice.id },
    data,
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_invoice_update",
    targetTenantId: input.organizationId,
    previousState: {
      invoiceId: invoice.id,
      amount: Number(invoice.amount),
      description: invoice.description,
      status: invoice.status,
    },
    newState: {
      invoiceId: updated.id,
      amount: Number(updated.amount),
      description: updated.description,
      status: updated.status,
    },
    metadata: { reason: input.reason ?? "owner_ops" },
  });

  return updated;
}

export async function voidTenantInvoiceByOwner(input: {
  platformUser: User;
  organizationId: string;
  invoiceId: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const { invoice } = await requireTenantInvoice(
    input.organizationId,
    input.invoiceId,
  );

  if (
    invoice.status !== BillingInvoiceStatus.OPEN &&
    invoice.status !== BillingInvoiceStatus.FAILED &&
    invoice.status !== BillingInvoiceStatus.DRAFT
  ) {
    throw new Error("Solo se pueden anular facturas abiertas, fallidas o borrador");
  }

  const updated = await db.billingInvoice.update({
    where: { id: invoice.id },
    data: {
      status: BillingInvoiceStatus.VOID,
      failureReason: null,
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_invoice_void",
    targetTenantId: input.organizationId,
    previousState: { invoiceId: invoice.id, status: invoice.status },
    newState: { invoiceId: updated.id, status: BillingInvoiceStatus.VOID },
    metadata: { reason: input.reason ?? "owner_ops" },
  });

  return updated;
}

export async function markTenantInvoicePaidByOwner(input: {
  platformUser: User;
  organizationId: string;
  invoiceId: string;
  paymentReference?: string;
  note?: string;
  activateSubscription?: boolean;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const { account, invoice } = await requireTenantInvoice(
    input.organizationId,
    input.invoiceId,
  );

  if (invoice.status === BillingInvoiceStatus.PAID) {
    return { invoice, alreadyPaid: true as const };
  }

  if (
    invoice.status !== BillingInvoiceStatus.OPEN &&
    invoice.status !== BillingInvoiceStatus.FAILED &&
    invoice.status !== BillingInvoiceStatus.DRAFT
  ) {
    throw new Error("Esta factura no se puede marcar como pagada");
  }

  const paidAt = new Date();
  const activate = input.activateSubscription !== false;
  const reference = input.paymentReference?.trim() || invoice.manualPaymentRef;
  const note = input.note?.trim() || invoice.manualPaymentNote;

  await db.$transaction([
    db.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: BillingInvoiceStatus.PAID,
        paidAt,
        failureReason: null,
        manualPaymentRef: reference || invoice.manualPaymentRef,
        manualPaymentNote: note || invoice.manualPaymentNote,
        manualSubmittedAt: invoice.manualSubmittedAt ?? (reference ? paidAt : null),
      },
    }),
    ...(activate
      ? [
          db.billingAccount.update({
            where: { id: account.id },
            data: {
              status: BillingSubscriptionStatus.ACTIVE,
              billingLockedAt: null,
              gracePeriodEndsAt: null,
              trialEndsAt: null,
              currentPeriodEnd: resolvePeriodEnd(paidAt),
            },
          }),
        ]
      : []),
  ]);

  await writePaymentAuditLog({
    entityType: "billing_invoice",
    entityId: invoice.id,
    action: "owner_marked_paid",
    actorId: input.platformUser.id,
    after: {
      reference: reference ?? null,
      activate,
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_invoice_mark_paid",
    targetTenantId: input.organizationId,
    previousState: { invoiceId: invoice.id, status: invoice.status },
    newState: {
      invoiceId: invoice.id,
      status: BillingInvoiceStatus.PAID,
      activate,
      paymentReference: reference ?? null,
    },
    metadata: { reason: input.reason ?? "owner_ops" },
  });

  queueBillingReceiptEmail({
    invoiceId: invoice.id,
    paymentMethod: "bank_transfer",
    paymentReference: reference ?? undefined,
  });

  const updated = await db.billingInvoice.findUniqueOrThrow({
    where: { id: invoice.id },
  });

  return { invoice: updated, alreadyPaid: false as const };
}

export async function confirmTenantManualPaymentByOwner(input: {
  platformUser: User;
  organizationId: string;
  invoiceId: string;
  note?: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const { invoice } = await requireTenantInvoice(
    input.organizationId,
    input.invoiceId,
  );

  if (!invoice.manualPaymentRef) {
    throw new Error("Esta factura no tiene comprobante manual pendiente");
  }

  return markTenantInvoicePaidByOwner({
    ...input,
    paymentReference: invoice.manualPaymentRef,
    activateSubscription: true,
  });
}
