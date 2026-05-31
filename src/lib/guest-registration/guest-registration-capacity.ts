import { BookingPlatform } from "@prisma/client";
import { isDefaultReservationOccupancy } from "@/lib/reservations/display-guest-count";

export type GuestRegistrationCapacityInput = {
  platform: BookingPlatform;
  adults: number;
  children: number;
  infants: number;
  propertyMaxGuests?: number | null;
  guestCountTotal?: number | null;
  guestRegistrationCompletedAt?: Date | null;
  registeredCount?: number;
};

/** Ocupación operativa para registro: adultos + niños (bebés no cuentan). */
export function getGuestRegistrationOccupancyBase(input: {
  adults: number;
  children: number;
  infants: number;
  guestCountTotal?: number | null;
  registeredCount?: number;
}): number {
  const base = Math.max(0, input.adults) + Math.max(0, input.children);
  if (base > 0) return base;

  if (input.guestCountTotal != null && input.guestCountTotal > 0) {
    return input.guestCountTotal;
  }

  const totalCurrent =
    Math.max(0, input.adults) +
    Math.max(0, input.children) +
    Math.max(0, input.infants);

  if (input.registeredCount != null && input.registeredCount > totalCurrent) {
    return input.registeredCount;
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

export function getGuestRegistrationMaxCapacity(
  input: GuestRegistrationCapacityInput,
): number {
  const occupancyBase = getGuestRegistrationOccupancyBase({
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    guestCountTotal: input.guestCountTotal,
    registeredCount: input.registeredCount,
  });

  if (
    !isReservationGuestDataComplete({
      platform: input.platform,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      guestRegistrationCompletedAt: input.guestRegistrationCompletedAt,
    })
  ) {
    const enrichedTotal =
      input.guestCountTotal != null && input.guestCountTotal > 0
        ? input.guestCountTotal
        : 0;
    const propertyCap = Math.max(1, input.propertyMaxGuests ?? 1);
    return Math.max(occupancyBase, enrichedTotal, propertyCap);
  }

  return Math.max(1, occupancyBase);
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
