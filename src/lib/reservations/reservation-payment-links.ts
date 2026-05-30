import { BookingPlatform } from "@prisma/client";

/** Solo reservas directas requieren cobro vía Payment Link (OTA cobra el canal). */
export function isPaymentLinkEligibleReservation(
  platform: BookingPlatform,
): boolean {
  return platform === BookingPlatform.DIRECT;
}

export const PAYMENT_LINK_INELIGIBLE_MESSAGE =
  "Los enlaces de cobro solo aplican a reservas directas. En Airbnb u otros canales el pago lo gestiona la plataforma.";
