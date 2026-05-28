import { BookingPlatform } from "@prisma/client";

export type ReservationDisplayGuestNameInput = {
  platform: BookingPlatform;
  airbnbEnrichment?: { guestName?: string | null } | null;
  airbnbGuestName?: string | null;
  airbnbEnrichmentGuestName?: string | null;
  guestName?: string | null;
  primaryGuestName?: string | null;
};

export function resolveReservationDisplayGuestName(
  input: ReservationDisplayGuestNameInput,
): string {
  const airbnbEnrichment =
    input.airbnbEnrichment?.guestName?.trim() ||
    input.airbnbGuestName?.trim() ||
    input.airbnbEnrichmentGuestName?.trim();
  if (input.platform === BookingPlatform.AIRBNB && airbnbEnrichment) {
    return airbnbEnrichment;
  }

  const reservationGuest = input.guestName?.trim();
  const isAirbnbPlaceholderGuest =
    input.platform === BookingPlatform.AIRBNB &&
    typeof reservationGuest === "string" &&
    /^hu[eé]sped airbnb$/i.test(reservationGuest);
  if (reservationGuest && !isAirbnbPlaceholderGuest) return reservationGuest;

  const primaryGuest = input.primaryGuestName?.trim();
  if (primaryGuest) return primaryGuest;

  return input.platform === BookingPlatform.AIRBNB
    ? "Huésped Airbnb"
    : "Sin huésped";
}
