import "server-only";

import {
  PaymentInvoiceLedgerStatus,
  PaymentMethodType,
  PaymentProviderCode,
  PaymentStatus,
  PaymentTransactionStatus,
  type GuestPaymentCategory,
  type GuestPaymentLinkStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { parseGuestPaymentReference } from "@/lib/payments/guest-payment-reference";
import {
  hasPaymentLedgerDelegates,
  isPaymentSchemaMissing,
} from "@/modules/billing/lib/billing-schema-guard";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";
import { createPaymentInvoice } from "@/modules/billing/repositories/invoice.repository";
import {
  createTransaction,
  findTransactionByProviderReference,
  updateTransactionStatus,
} from "@/modules/billing/repositories/transaction.repository";
import {
  getReservationPaymentBalance,
} from "@/services/payments/reservation-payment-balance";
import { ensureFinancialEntryForGuestPayment } from "@/services/payments/guest-payment-financial-entry";
import {
  fetchWompiTransactionById,
  fetchWompiTransactionByReference,
  guestReferenceForLink,
  mapWompiPaymentMethod,
} from "@/services/payments/wompi-transaction-lookup.service";
import { guestPaymentIncomeLabel } from "@/lib/payments/guest-payment-categories";
import { releaseReservationHoldIfDepositMet } from "@/services/reservations/reservation-hold.service";

function mapWompiToLinkStatus(
  status: PaymentTransactionStatus,
): GuestPaymentLinkStatus | null {
  switch (status) {
    case PaymentTransactionStatus.APPROVED:
      return "PAID";
    case PaymentTransactionStatus.PENDING:
      return "PROCESSING";
    case PaymentTransactionStatus.DECLINED:
    case PaymentTransactionStatus.FAILED:
      return "FAILED";
    case PaymentTransactionStatus.CANCELLED:
      return "CANCELLED";
    default:
      return null;
  }
}

function mapCategoryToIncomeType(category: GuestPaymentCategory): string {
  return guestPaymentIncomeLabel(category);
}

async function syncReservationPaymentStatus(reservationId: string) {
  const balance = await getReservationPaymentBalance(reservationId);
  let paymentStatus: PaymentStatus = PaymentStatus.PENDING;

  if (balance.paidAmount <= 0) {
    paymentStatus = PaymentStatus.PENDING;
  } else if (balance.remainingBalance <= 0.009) {
    paymentStatus = PaymentStatus.PAID;
  } else {
    paymentStatus = PaymentStatus.PARTIAL;
  }

  await db.reservation.update({
    where: { id: reservationId },
    data: { paymentStatus },
  });

  if (paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.PARTIAL) {
    await releaseReservationHoldIfDepositMet(reservationId);
  }
}

export async function reconcileGuestPaymentFromWebhook(input: {
  reference: string;
  providerTransactionId?: string;
  status: PaymentTransactionStatus;
  paymentMethod?: PaymentMethodType;
  failureReason?: string;
}): Promise<{ ok: boolean; message: string }> {
  const linkId = parseGuestPaymentReference(input.reference);
  if (!linkId) {
    return { ok: true, message: "No es referencia de guest payment" };
  }

  const link = await db.guestPaymentLink.findUnique({
    where: { id: linkId },
    include: {
      reservation: {
        select: {
          id: true,
          guestEmail: true,
          paymentStatus: true,
        },
      },
    },
  });

  if (!link) {
    return { ok: true, message: "Guest payment link desconocido (idempotente)" };
  }

  const existingTx = hasPaymentLedgerDelegates()
    ? await findTransactionByProviderReference(
        PaymentProviderCode.WOMPI,
        input.reference,
      )
    : null;

  if (
    existingTx?.status === PaymentTransactionStatus.APPROVED &&
    input.status === PaymentTransactionStatus.APPROVED &&
    link.status === "PAID"
  ) {
    return { ok: true, message: "Pago guest ya reconciliado (idempotente)" };
  }

  const mappedLinkStatus = mapWompiToLinkStatus(input.status);

  if (hasPaymentLedgerDelegates()) {
    try {
      let paymentInvoiceId = link.paymentInvoiceId;

      if (!paymentInvoiceId) {
        const invoice = await createPaymentInvoice({
          tenantId: link.organizationId,
          reservation: link.reservationId
            ? { connect: { id: link.reservationId } }
            : undefined,
          subtotal: Number(link.amount),
          fees: 0,
          taxes: 0,
          total: Number(link.amount),
          currency: link.currency,
          status:
            input.status === PaymentTransactionStatus.APPROVED
              ? PaymentInvoiceLedgerStatus.PAID
              : PaymentInvoiceLedgerStatus.OPEN,
          dueAt: link.expiresAt ?? new Date(),
          paidAt:
            input.status === PaymentTransactionStatus.APPROVED
              ? new Date()
              : null,
          description: link.description,
          metadata: {
            source: "guest_payment_link",
            guestPaymentLinkId: link.id,
            category: link.category,
            incomeCategory: mapCategoryToIncomeType(link.category),
          },
        });
        paymentInvoiceId = invoice.id;
        await db.guestPaymentLink.update({
          where: { id: link.id },
          data: { paymentInvoiceId },
        });
      }

      if (!existingTx && paymentInvoiceId) {
        await createTransaction({
          tenantId: link.organizationId,
          invoice: { connect: { id: paymentInvoiceId } },
          reservationId: link.reservationId,
          amount: Number(link.amount),
          currency: link.currency,
          provider: PaymentProviderCode.WOMPI,
          providerReference: input.reference,
          status: input.status,
          paymentMethod: input.paymentMethod ?? PaymentMethodType.OTHER,
          idempotencyKey: `guest-wh-${link.id}`,
          metadata: {
            guestPaymentLinkId: link.id,
            providerTransactionId: input.providerTransactionId,
            failureReason: input.failureReason,
          },
        });
      } else if (existingTx) {
        await updateTransactionStatus(existingTx.id, {
          status: input.status,
          providerReference: input.providerTransactionId ?? input.reference,
          paymentMethod: input.paymentMethod,
          metadata: input.failureReason
            ? { failureReason: input.failureReason }
            : undefined,
        });
      }
    } catch (error) {
      if (!isPaymentSchemaMissing(error)) throw error;
    }
  }

  if (mappedLinkStatus) {
    await db.guestPaymentLink.update({
      where: { id: link.id },
      data: {
        status: mappedLinkStatus,
        updatedAt: new Date(),
      },
    });
  }

  if (
    link.reservationId &&
    input.status === PaymentTransactionStatus.APPROVED
  ) {
    await syncReservationPaymentStatus(link.reservationId);
  }

  if (input.status === PaymentTransactionStatus.APPROVED) {
    await ensureFinancialEntryForGuestPayment(link);
  }

  await writePaymentAuditLog({
    entityType: "guest_payment_link",
    entityId: link.id,
    action:
      input.status === PaymentTransactionStatus.APPROVED
        ? "payment_approved"
        : "payment_status_updated",
    after: {
      reference: input.reference,
      status: input.status,
      linkStatus: mappedLinkStatus,
    },
  });

  return {
    ok: true,
    message:
      input.status === PaymentTransactionStatus.APPROVED
        ? "Guest payment reconciliado"
        : "Estado guest payment actualizado",
  };
}

/** Fallback: expira enlaces vencidos sin pago. */
export async function expireStaleGuestPaymentLinks(): Promise<number> {
  const now = new Date();
  const result = await db.guestPaymentLink.updateMany({
    where: {
      expiresAt: { lt: now },
      status: { in: ["SENT", "PENDING", "PROCESSING", "DRAFT"] },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

/** Reconciliación automática vía API Wompi si el webhook no llegó. */
export async function reconcilePendingGuestPaymentsFromWompi(): Promise<{
  scanned: number;
  reconciled: number;
  failed: number;
}> {
  const pending = await db.guestPaymentLink.findMany({
    where: {
      status: { in: ["SENT", "PENDING", "PROCESSING"] },
    },
    take: 40,
    orderBy: { updatedAt: "asc" },
  });

  let reconciled = 0;
  let failed = 0;

  for (const link of pending) {
    const reference = guestReferenceForLink(link.id);
    let transactionId =
      link.wompiLinkId ??
      (typeof (link.metadata as Record<string, unknown> | null)?.lastWompiTransactionId ===
      "string"
        ? String((link.metadata as Record<string, unknown>).lastWompiTransactionId)
        : null);

    const lookup = transactionId
      ? await fetchWompiTransactionById({
          organizationId: link.organizationId,
          transactionId,
        })
      : await fetchWompiTransactionByReference({
          organizationId: link.organizationId,
          reference,
        });

    if (!lookup.ok) {
      failed += 1;
      continue;
    }

    if (!transactionId && "transactionId" in lookup && lookup.transactionId) {
      transactionId = lookup.transactionId;
    }

    const status =
      lookup.status ?? PaymentTransactionStatus.PENDING;

    if (status === PaymentTransactionStatus.PENDING) {
      continue;
    }

    const result = await reconcileGuestPaymentFromWebhook({
      reference,
      providerTransactionId: transactionId ?? undefined,
      status,
      paymentMethod:
        "paymentMethod" in lookup ? lookup.paymentMethod : undefined,
    });

    if (result.ok && status === PaymentTransactionStatus.APPROVED) {
      reconciled += 1;
      if (transactionId) {
        const meta = (link.metadata ?? {}) as Record<string, unknown>;
        await db.guestPaymentLink.update({
          where: { id: link.id },
          data: {
            metadata: { ...meta, lastWompiTransactionId: transactionId },
          },
        });
      }
    } else if (!result.ok) {
      failed += 1;
    }
  }

  return { scanned: pending.length, reconciled, failed };
}

export async function runGuestPaymentReconciliationJob(): Promise<{
  expired: number;
  autoLinksCancelled: number;
  holdsReleased: number;
  wompi: { scanned: number; reconciled: number; failed: number };
}> {
  const expired = await expireStaleGuestPaymentLinks();
  const { expireStaleReservationHolds, cancelAutoIssuedHoldDepositLinks } =
    await import("@/services/reservations/reservation-hold.service");
  let autoLinksCancelled = 0;
  if (process.env.ENABLE_AUTO_PAYMENT_LINK_CLEANUP === "true") {
    autoLinksCancelled = await cancelAutoIssuedHoldDepositLinks();
  } else {
    console.info("AUTO PAYMENT LINK CLEANUP SKIPPED");
  }
  const holdsReleased = await expireStaleReservationHolds();
  const wompi = await reconcilePendingGuestPaymentsFromWompi();
  return { expired, autoLinksCancelled, holdsReleased, wompi };
}
