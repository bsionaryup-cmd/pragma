import {
  BillingInvoiceStatus,
  PaymentInvoiceLedgerStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { TENANT_SINGLETON } from "@/modules/billing/domain/constants";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
} from "@/modules/billing/lib/billing-schema-guard";
import {
  createPaymentInvoice,
  findPaymentInvoiceByBillingInvoiceId,
  updatePaymentInvoiceStatus,
} from "@/modules/billing/repositories/invoice.repository";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";

function mapBillingStatusToLedger(
  status: BillingInvoiceStatus,
): PaymentInvoiceLedgerStatus {
  switch (status) {
    case BillingInvoiceStatus.PAID:
      return PaymentInvoiceLedgerStatus.PAID;
    case BillingInvoiceStatus.FAILED:
      return PaymentInvoiceLedgerStatus.FAILED;
    case BillingInvoiceStatus.VOID:
      return PaymentInvoiceLedgerStatus.VOID;
    case BillingInvoiceStatus.DRAFT:
      return PaymentInvoiceLedgerStatus.DRAFT;
    default:
      return PaymentInvoiceLedgerStatus.OPEN;
  }
}

export async function ensurePaymentInvoiceForBillingInvoice(
  billingInvoiceId: string,
) {
  if (!hasPaymentLedgerDelegates()) return null;

  const existing = await findPaymentInvoiceByBillingInvoiceId(billingInvoiceId);
  if (existing) return existing;

  const billingInvoice = await db.billingInvoice.findUnique({
    where: { id: billingInvoiceId },
  });
  if (!billingInvoice) return null;

  const billingAccount = await db.billingAccount.findUnique({
    where: { id: billingInvoice.billingAccountId },
    select: { organizationId: true, id: true },
  });
  const tenantId =
    billingAccount?.organizationId ?? billingAccount?.id ?? TENANT_SINGLETON;

  try {
    const amount = Number(billingInvoice.amount);
    const paymentInvoice = await createPaymentInvoice({
      tenantId,
      billingInvoice: { connect: { id: billingInvoiceId } },
      subtotal: amount,
      fees: 0,
      taxes: 0,
      total: amount,
      currency: billingInvoice.currency,
      status: mapBillingStatusToLedger(billingInvoice.status),
      dueAt: billingInvoice.dueAt,
      paidAt: billingInvoice.paidAt,
      description: billingInvoice.description,
      metadata: { source: "billing_subscription" },
    });

    await writePaymentAuditLog({
      entityType: "payment_invoice",
      entityId: paymentInvoice.id,
      action: "created_from_billing_invoice",
      after: { billingInvoiceId },
    });

    return paymentInvoice;
  } catch (error) {
    if (isPaymentSchemaMissing(error)) return null;
    throw error;
  }
}

export async function markPaymentInvoicePaid(
  paymentInvoiceId: string,
  paidAt = new Date(),
) {
  const updated = await updatePaymentInvoiceStatus(
    paymentInvoiceId,
    PaymentInvoiceLedgerStatus.PAID,
    paidAt,
  );
  await writePaymentAuditLog({
    entityType: "payment_invoice",
    entityId: paymentInvoiceId,
    action: "marked_paid",
    after: { paidAt: paidAt.toISOString() },
  });
  return updated;
}

export async function markPaymentInvoiceFailed(paymentInvoiceId: string) {
  return updatePaymentInvoiceStatus(
    paymentInvoiceId,
    PaymentInvoiceLedgerStatus.FAILED,
  );
}

export async function createReservationPaymentInvoice(input: {
  reservationId: string;
  guestId?: string;
  subtotal: number;
  fees?: number;
  taxes?: number;
  currency?: string;
  dueAt: Date;
  description?: string;
}) {
  if (!hasPaymentLedgerDelegates()) {
    throw new Error("Payment ledger no disponible. Ejecuta db:migrate:deploy.");
  }

  const fees = input.fees ?? 0;
  const taxes = input.taxes ?? 0;
  const total = input.subtotal + fees + taxes;

  const invoice = await createPaymentInvoice({
    tenantId: TENANT_SINGLETON,
    reservation: { connect: { id: input.reservationId } },
    guestId: input.guestId ?? null,
    subtotal: input.subtotal,
    fees,
    taxes,
    total,
    currency: input.currency ?? "COP",
    status: PaymentInvoiceLedgerStatus.OPEN,
    dueAt: input.dueAt,
    description: input.description ?? "Pago de reserva",
    metadata: { source: "reservation" },
  });

  await writePaymentAuditLog({
    entityType: "payment_invoice",
    entityId: invoice.id,
    action: "created_for_reservation",
    after: { reservationId: input.reservationId },
  });

  return invoice;
}
