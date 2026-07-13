import { BookingPlatform } from "@prisma/client";
import { isDefaultReservationOccupancy } from "@/lib/reservations/display-guest-count";

export type GuestRegistrationCapacityInput = {
  platform: BookingPlatform;
  adults: number;
  children: number;
  infants: number;
  propertyMaxGuests?: number | null;
  /** @deprecated Reservation is the SSOT; ignored. */
  guestCountTotal?: number | null;
  /** @deprecated Reservation is the SSOT; ignored. */
  enrichedAdultCount?: number | null;
  /** @deprecated Reservation is the SSOT; ignored. */
  enrichedChildCount?: number | null;
  guestRegistrationCompletedAt?: Date | null;
  registeredCount?: number;
};

/** Ocupación operativa para registro: adultos + niños (bebés no cuentan). */
export function getGuestRegistrationOccupancyBase(input: {
  adults: number;
  children: number;
  infants: number;
  registeredCount?: number;
}): number {
  const base = Math.max(0, input.adults) + Math.max(0, input.children);
  if (base > 0) return base;

  const totalCurrent =
    Math.max(0, input.adults) +
    Math.max(0, input.children) +
    Math.max(0, input.infants);

  if (input.registeredCount != null && input.registeredCount > totalCurrent) {
    return totalCurrent > 0 ? totalCurrent : 1;
  }

  return Math.max(1, totalCurrent);
}

/** Airbnb iCal placeholder 1/0/0 antes de enriquecimiento por correo. */
export function isReservationGuestDataComplete(input: {
  platform: BookingPlatform;
  adults: number;
  children: number;
  infants: number;
  guestRegistrationCompletedAt?: Date | null;
}): boolean {
  if (input.platform !== BookingPlatform.AIRBNB) return true;
  if (input.guestRegistrationCompletedAt) return true;
  return !isDefaultReservationOccupancy(input.adults, input.children, input.infants);
}

/** Límite operativo de la reserva: adultos + niños (sin bebés). */
function getReservationRegistrationLimit(
  input: GuestRegistrationCapacityInput,
): number {
  return getGuestRegistrationOccupancyBase({
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    registeredCount: input.registeredCount,
  });
}

export function getGuestRegistrationMaxCapacity(
  input: GuestRegistrationCapacityInput,
): number {
  const limit = getReservationRegistrationLimit(input);
  return Math.max(1, limit);
}

/** Informacional en UI pública (incluye bebés en el total mostrado). */
export function getReservationGuestCount(input: {
  adults: number;
  children: number;
  infants: number;
}): number {
  return Math.max(
    1,
    Math.max(0, input.adults) +
      Math.max(0, input.children) +
      Math.max(0, input.infants),
  );
}
