import "server-only";

import { db } from "@/lib/db";
import { getHoldMinimumAmount } from "@/lib/reservations/reservation-hold";
import { isWompiConfiguredForOrganization } from "@/modules/billing/services/wompi-credentials";
import { createGuestWompiCheckout } from "@/services/payments/guest-wompi-checkout.service";

export type WebBookingPaymentHold = {
  paymentRequired: boolean;
  checkoutUrl: string | null;
  reason?: string;
  paymentLinkId?: string;
  holdExpiresAt?: string;
  depositAmount?: number;
};

const ACTIVE_DEPOSIT_STATUSES = ["DRAFT", "SENT", "PENDING", "PROCESSING"] as const;

export async function resolveWebBookingPaymentHold(input: {
  organizationId: string;
  reservationId: string;
  propertyId: string;
  createdById: string;
  totalAmount: number;
  guestName: string;
  currency: string;
  guestEmail?: string | null;
}): Promise<WebBookingPaymentHold> {
  if (input.totalAmount <= 0) {
    return { paymentRequired: false, checkoutUrl: null };
  }

  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    select: { holdExpiresAt: true },
  });
  const holdExpiresAt = reservation?.holdExpiresAt ?? null;
  const depositAmount = Math.min(
    getHoldMinimumAmount(input.totalAmount),
    input.totalAmount,
  );
  const holdIso = holdExpiresAt?.toISOString();

  const wompiConfigured = await isWompiConfiguredForOrganization(
    input.organizationId,
  );
  if (!wompiConfigured) {
    return {
      paymentRequired: true,
      checkoutUrl: null,
      reason:
        "Pago pendiente: conecta Wompi del tenant en Integraciones → Wompi para obtener enlace de checkout en la reserva web.",
      holdExpiresAt: holdIso,
      depositAmount,
    };
  }

  const existingLink = await db.guestPaymentLink.findFirst({
    where: {
      reservationId: input.reservationId,
      organizationId: input.organizationId,
      category: "DEPOSIT",
      status: { in: [...ACTIVE_DEPOSIT_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      wompiCheckoutUrl: true,
      epaycoCheckoutUrl: true,
    },
  });

  const existingCheckout =
    existingLink?.wompiCheckoutUrl ?? existingLink?.epaycoCheckoutUrl ?? null;
  if (existingLink && existingCheckout) {
    return {
      paymentRequired: true,
      checkoutUrl: existingCheckout,
      paymentLinkId: existingLink.id,
      holdExpiresAt: holdIso,
      depositAmount,
    };
  }

  const draft = await db.guestPaymentLink.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      category: "DEPOSIT",
      description: `Depósito 50% · ${input.guestName}`,
      amount: depositAmount,
      currency: input.currency,
      status: "DRAFT",
      reservationId: input.reservationId,
      propertyId: input.propertyId,
      guestName: input.guestName,
      expiresAt: holdExpiresAt,
      notes: "[WEB_BUILDER] checkout_auto",
    },
  });

  const checkout = await createGuestWompiCheckout({
    organizationId: input.organizationId,
    linkId: draft.id,
    description: draft.description,
    amount: depositAmount,
    currency: input.currency,
    customerEmail: input.guestEmail,
  });

  if (!checkout.ok || !checkout.checkoutUrl) {
    await db.guestPaymentLink.update({
      where: { id: draft.id },
      data: {
        status: "CANCELLED",
        notes: `[WEB_BUILDER] ${checkout.message}`,
      },
    });
    return {
      paymentRequired: true,
      checkoutUrl: null,
      reason: checkout.message,
      holdExpiresAt: holdIso,
      depositAmount,
    };
  }

  await db.guestPaymentLink.update({
    where: { id: draft.id },
    data: {
      status: "SENT",
      paymentGateway: "WOMPI",
      wompiCheckoutUrl: checkout.checkoutUrl,
      wompiLinkId: checkout.wompiLinkId ?? null,
    },
  });

  return {
    paymentRequired: true,
    checkoutUrl: checkout.checkoutUrl,
    paymentLinkId: draft.id,
    holdExpiresAt: holdIso,
    depositAmount,
  };
}

export async function loadWebBookingPaymentHoldForReservation(input: {
  organizationId: string;
  reservationId: string;
  totalAmount: number;
}): Promise<WebBookingPaymentHold> {
  if (input.totalAmount <= 0) {
    return { paymentRequired: false, checkoutUrl: null };
  }

  const [reservation, link] = await Promise.all([
    db.reservation.findUnique({
      where: { id: input.reservationId },
      select: { holdExpiresAt: true },
    }),
    db.guestPaymentLink.findFirst({
      where: {
        reservationId: input.reservationId,
        organizationId: input.organizationId,
        category: "DEPOSIT",
        status: { in: [...ACTIVE_DEPOSIT_STATUSES, "PAID"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        wompiCheckoutUrl: true,
        epaycoCheckoutUrl: true,
        status: true,
      },
    }),
  ]);

  const depositAmount = getHoldMinimumAmount(input.totalAmount);
  const checkoutUrl =
    link?.wompiCheckoutUrl ?? link?.epaycoCheckoutUrl ?? null;

  if (checkoutUrl) {
    return {
      paymentRequired: true,
      checkoutUrl,
      paymentLinkId: link?.id,
      holdExpiresAt: reservation?.holdExpiresAt?.toISOString(),
      depositAmount,
    };
  }

  const wompiConfigured = await isWompiConfiguredForOrganization(
    input.organizationId,
  );

  return {
    paymentRequired: true,
    checkoutUrl: null,
    reason: wompiConfigured
      ? "Pago pendiente: no hay enlace de checkout activo para esta reserva."
      : "Pago pendiente: conecta Wompi del tenant en Integraciones → Wompi.",
    holdExpiresAt: reservation?.holdExpiresAt?.toISOString(),
    depositAmount,
  };
}