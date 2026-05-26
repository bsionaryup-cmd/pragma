import "server-only";

import {
  BookingPlatform,
  PaymentStatus,
  ReservationStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  computeHoldExpiresAt,
  hasSatisfiedHoldDeposit,
} from "@/lib/reservations/reservation-hold";
import { emitBookingCancelled } from "@/modules/integrations/ttlock/ttlock.events";
import { touchPropertyIcalExport } from "@/services/airbnb/airbnb-export-push.service";
import {
  ensureGuestRegistrationForReservation,
  isGuestRegistrationEligiblePlatform,
  isGuestRegistrationEligibleStatus,
} from "@/services/guests/guest-registration.service";
import { sendGuestRegistrationEmailForReservation } from "@/services/guests/guest-registration-email.service";
import { createReservationPaymentLink } from "@/services/payments/guest-payment-link.service";
import { getReservationPaymentBalance } from "@/services/payments/reservation-payment-balance";

const ACTIVE_LINK_STATUSES = ["DRAFT", "SENT", "PENDING", "PROCESSING"] as const;

export async function activateReservationPaymentHold(input: {
  reservationId: string;
  createdById: string;
  totalAmount: number;
}): Promise<{ paymentLinkIssued: boolean }> {
  if (input.totalAmount <= 0) {
    return { paymentLinkIssued: false };
  }

  const holdExpiresAt = computeHoldExpiresAt();
  await db.reservation.update({
    where: { id: input.reservationId },
    data: {
      holdExpiresAt,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  try {
    await createReservationPaymentLink({
      reservationId: input.reservationId,
      mode: "deposit_50",
      createdById: input.createdById,
      issue: true,
      expiresAt: holdExpiresAt,
    });
    return { paymentLinkIssued: true };
  } catch (error) {
    console.warn(
      "[reservation-hold] No se pudo emitir enlace de depósito",
      input.reservationId,
      error,
    );
    return { paymentLinkIssued: false };
  }
}

async function finalizeGuestRegistrationAfterHold(reservationId: string) {
  const row = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      platform: true,
      status: true,
      guestEmail: true,
    },
  });
  if (!row) return;

  if (
    !isGuestRegistrationEligiblePlatform(row.platform) ||
    !isGuestRegistrationEligibleStatus(row.status)
  ) {
    return;
  }

  await ensureGuestRegistrationForReservation(reservationId);
  if (row.guestEmail?.trim()) {
    await sendGuestRegistrationEmailForReservation(reservationId).catch((err) => {
      console.warn("[guest-registration-email] Post-hold", reservationId, err);
    });
  }
}

/** Tras pago Wompi: confirma hold si el depósito mínimo está cubierto. */
export async function releaseReservationHoldIfDepositMet(
  reservationId: string,
): Promise<boolean> {
  const row = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      holdExpiresAt: true,
      totalAmount: true,
      paymentStatus: true,
    },
  });
  if (!row?.holdExpiresAt) return false;

  const balance = await getReservationPaymentBalance(reservationId);
  if (!hasSatisfiedHoldDeposit(balance.paidAmount, Number(row.totalAmount))) {
    return false;
  }

  await db.reservation.update({
    where: { id: reservationId },
    data: { holdExpiresAt: null },
  });

  await finalizeGuestRegistrationAfterHold(reservationId);
  return true;
}

/** Cron: libera disponibilidad si el hold expiró sin depósito. */
export async function expireStaleReservationHolds(): Promise<number> {
  const now = new Date();
  const rows = await db.reservation.findMany({
    where: {
      holdExpiresAt: { lt: now },
      platform: BookingPlatform.DIRECT,
      status: { not: ReservationStatus.CANCELLED },
    },
    select: {
      id: true,
      propertyId: true,
      totalAmount: true,
      paymentStatus: true,
    },
    take: 40,
    orderBy: { holdExpiresAt: "asc" },
  });

  let released = 0;

  for (const row of rows) {
    const balance = await getReservationPaymentBalance(row.id);

    if (
      hasSatisfiedHoldDeposit(balance.paidAmount, Number(row.totalAmount)) ||
      balance.paidAmount > 0.009
    ) {
      await db.reservation.update({
        where: { id: row.id },
        data: { holdExpiresAt: null },
      });
      if (balance.paidAmount > 0.009) {
        await finalizeGuestRegistrationAfterHold(row.id);
      }
      continue;
    }

    await db.guestPaymentLink.updateMany({
      where: {
        reservationId: row.id,
        status: { in: [...ACTIVE_LINK_STATUSES] },
      },
      data: { status: "CANCELLED" },
    });

    await db.reservation.update({
      where: { id: row.id },
      data: {
        status: ReservationStatus.CANCELLED,
        holdExpiresAt: null,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    const property = await db.property.findUnique({
      where: { id: row.propertyId },
      select: { ownerId: true },
    });
    if (property) {
      await emitBookingCancelled({
        reservationId: row.id,
        propertyId: row.propertyId,
        ownerId: property.ownerId,
      });
    }

    await touchPropertyIcalExport(row.propertyId);
    released += 1;
  }

  return released;
}
