import "server-only";

import type { GuestPaymentLinkStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { computeReservationPaymentBalance } from "@/lib/payments/reservation-payment-balance-calc";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { assertReservationInScope } from "@/lib/platform/tenant-access";

const COMMITTED_STATUSES: GuestPaymentLinkStatus[] = [
  "SENT",
  "PENDING",
  "PROCESSING",
  "PAID",
];

const PAID_STATUSES: GuestPaymentLinkStatus[] = ["PAID"];

export type ReservationPaymentBalance = {
  reservationId: string;
  totalAmount: number;
  paidAmount: number;
  manualPaidAmount: number;
  linkPaidAmount: number;
  pendingAmount: number;
  remainingBalance: number;
  currency: string;
  guestName: string;
  propertyId: string;
};

export { computeReservationPaymentBalance } from "@/lib/payments/reservation-payment-balance-calc";

export async function getReservationPaymentBalance(
  reservationId: string,
): Promise<ReservationPaymentBalance> {
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, reservationId);

  const row = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      totalAmount: true,
      currency: true,
      guestName: true,
      propertyId: true,
    },
  });

  if (!row) {
    throw new Error("Reserva no encontrada");
  }

  const [links, manualPayments] = await Promise.all([
    db.guestPaymentLink.findMany({
      where: {
        reservationId,
        status: { in: COMMITTED_STATUSES },
      },
      select: { amount: true, status: true },
    }),
    db.reservationPayment.findMany({
      where: { reservationId },
      select: { amount: true },
    }),
  ]);

  const totalAmount = Number(row.totalAmount);
  const computed = computeReservationPaymentBalance({
    totalAmount,
    links: links.map((link) => ({
      amount: Number(link.amount),
      status: link.status,
    })),
    manualPayments: manualPayments.map((payment) => ({
      amount: Number(payment.amount),
    })),
  });

  return {
    reservationId: row.id,
    totalAmount,
    ...computed,
    currency: row.currency,
    guestName: row.guestName,
    propertyId: row.propertyId,
  };
}

export function assertAmountWithinReservationBalance(
  balance: ReservationPaymentBalance,
  amount: number,
): void {
  if (amount <= 0) {
    throw new Error("El monto debe ser mayor a cero");
  }
  if (amount > balance.remainingBalance + 0.009) {
    throw new Error(
      `El monto supera el saldo pendiente (${balance.remainingBalance.toLocaleString()} ${balance.currency})`,
    );
  }
}
