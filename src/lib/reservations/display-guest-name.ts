import { BookingPlatform } from "@prisma/client";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";

export type ReservationDisplayGuestNameInput = {
  platform: BookingPlatform;
  airbnbEnrichment?: { guestName?: string | null } | null;
  airbnbGuestName?: string | null;
  airbnbEnrichmentGuestName?: string | null;
  guestName?: string | null;
  primaryGuestName?: string | null;
  guestRegistrationCompletedAt?: Date | string | null;
};

function hasRegisteredGuestDisplayName(input: {
  platform: BookingPlatform;
  guestName?: string | null;
  guestRegistrationCompletedAt?: Date | string | null;
}): boolean {
  if (input.platform !== BookingPlatform.AIRBNB) return false;
  if (!input.guestRegistrationCompletedAt) return false;
  const reservationGuest = input.guestName?.trim();
  if (!reservationGuest) return false;
  return (
    !isPlaceholderGuestName(reservationGuest) &&
    isPlausibleGuestName(reservationGuest)
  );
}

export function resolveReservationDisplayGuestName(
  input: ReservationDisplayGuestNameInput,
): string {
  if (hasRegisteredGuestDisplayName(input)) {
    return input.guestName!.trim();
  }

  const airbnbEnrichment =
    input.airbnbEnrichment?.guestName?.trim() ||
    input.airbnbGuestName?.trim() ||
    input.airbnbEnrichmentGuestName?.trim();
  if (
    input.platform === BookingPlatform.AIRBNB &&
    airbnbEnrichment &&
    !isPlaceholderGuestName(airbnbEnrichment) &&
    isPlausibleGuestName(airbnbEnrichment)
  ) {
    return airbnbEnrichment;
  }

  const reservationGuest = input.guestName?.trim();
  if (
    reservationGuest &&
    !(input.platform === BookingPlatform.AIRBNB && isPlaceholderGuestName(reservationGuest)) &&
    (input.platform !== BookingPlatform.AIRBNB || isPlausibleGuestName(reservationGuest))
  ) {
    return reservationGuest;
  }

  const primaryGuest = input.primaryGuestName?.trim();
  if (primaryGuest) return primaryGuest;

  return input.platform === BookingPlatform.AIRBNB
    ? "Huésped Airbnb"
    : "Sin huésped";
}
