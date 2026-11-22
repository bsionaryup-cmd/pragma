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

export function resolveReservationDisplayGuestName(
  input: ReservationDisplayGuestNameInput,
): string {
  // After guest registration, prefer ReservationGuest (primary/owner).
  // OCP Phase 2 no longer copies that name onto reservation.guestName, so using
  // reservation.guestName here would keep iCal pseudo-names (e.g. "UIVis Guest-…").
  const registeredPrimary = input.primaryGuestName?.trim();
  if (
    input.guestRegistrationCompletedAt &&
    registeredPrimary &&
    isPlausibleGuestName(registeredPrimary)
  ) {
    return registeredPrimary;
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

  if (registeredPrimary) return registeredPrimary;

  return input.platform === BookingPlatform.AIRBNB
    ? "Huésped Airbnb"
    : "Sin huésped";
}
