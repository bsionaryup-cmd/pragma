import "server-only";

import type { GuestPaymentLinkStatus } from "@prisma/client";
import { db } from "@/lib/db";
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
  pendingAmount: number;
  remainingBalance: number;
  currency: string;
  guestName: string;
  propertyId: string;
};

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

  const links = await db.guestPaymentLink.findMany({
    where: {
      reservationId,
      status: { in: COMMITTED_STATUSES },
    },
    select: { amount: true, status: true },
  });

  const paidAmount = links
    .filter((l) => PAID_STATUSES.includes(l.status))
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const pendingAmount = links
    .filter((l) => l.status !== "PAID")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  const totalAmount = Number(row.totalAmount);
  const remainingBalance = Math.max(0, totalAmount - paidAmount - pendingAmount);

  return {
    reservationId: row.id,
    totalAmount,
    paidAmount,
    pendingAmount,
    remainingBalance,
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
