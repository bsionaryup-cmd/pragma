import "server-only";

import { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getReservationPaymentBalance } from "@/services/payments/reservation-payment-balance";
import { releaseReservationHoldIfDepositMet } from "@/services/reservations/reservation-hold.service";

export async function syncReservationPaymentStatus(
  reservationId: string,
): Promise<void> {
  const balance = await getReservationPaymentBalance(reservationId);
  let paymentStatus: PaymentStatus = PaymentStatus.PENDING;

  if (balance.paidAmount <= 0) {
    paymentStatus = PaymentStatus.PENDING;
  } else if (balance.remainingBalance <= 0.009) {
    paymentStatus = PaymentStatus.PAID;
  } else {
    paymentStatus = PaymentStatus.PARTIAL;
  }

  const data: { paymentStatus: PaymentStatus; holdExpiresAt?: null } = {
    paymentStatus,
  };

  if (balance.paidAmount > 0.009) {
    data.holdExpiresAt = null;
  }

  await db.reservation.update({
    where: { id: reservationId },
    data,
  });

  if (balance.paidAmount > 0.009) {
    await releaseReservationHoldIfDepositMet(reservationId);
  }
}
