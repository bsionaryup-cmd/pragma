import { BookingPlatform, ReservationGuestStatus } from "@prisma/client";
import type { GuestCountEnrichment } from "@/lib/reservations/display-guest-count";
import { getGuestRegistrationMaxCapacity } from "@/lib/guest-registration/guest-registration-capacity";
import {
  isAirbnbGuestRegistrationCapacityPlatform,
  resolveGuestRegistrationCapacity,
  type ResolveGuestRegistrationCapacityInput,
} from "@/lib/guest-registration/resolve-guest-registration-capacity";
import { db } from "@/lib/db";
import { getAirbnbEnrichedGuestCountsByReservationIds } from "@/services/reservations/airbnb-display-guest-count.service";

export type GuestRegistrationCapacityContext = ResolveGuestRegistrationCapacityInput & {
  id: string;
};

export async function loadEmailEnrichmentForReservation(
  reservationId: string,
  platform: BookingPlatform,
): Promise<GuestCountEnrichment | null> {
  if (!isAirbnbGuestRegistrationCapacityPlatform(platform)) return null;
  const map = await getAirbnbEnrichedGuestCountsByReservationIds([reservationId]);
  return map.get(reservationId) ?? null;
}

export async function resolveGuestRegistrationMaxCapacityForReservation(input: {
  id: string;
  platform: BookingPlatform;
  adults: number;
  children: number;
  infants: number;
  propertyMaxGuests?: number | null;
  guestRegistrationCompletedAt?: Date | null;
  registeredCount?: number;
  emailEnrichment?: GuestCountEnrichment | null;
}): Promise<number> {
  const emailEnrichment =
    input.emailEnrichment ??
    (await loadEmailEnrichmentForReservation(input.id, input.platform));

  const resolved = resolveGuestRegistrationCapacity({
    platform: input.platform,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    propertyMaxGuests: input.propertyMaxGuests,
    guestRegistrationCompletedAt: input.guestRegistrationCompletedAt,
    registeredCount: input.registeredCount,
    emailEnrichment,
  });

  return resolved.maxCapacity;
}

/**
 * Corrige adults/children/infants en reserva cuando hay evidencia de email o techo
 * de propiedad, sin tocar reservas ya completadas ni borrar huéspedes registrados.
 */
export async function reconcileReservationOccupancyIfSafe(
  reservationId: string,
): Promise<{ reconciled: boolean; reason: string | null }> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      platform: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
      property: { select: { maxGuests: true } },
    },
  });

  if (!reservation || reservation.guestRegistrationCompletedAt) {
    return { reconciled: false, reason: null };
  }

  const registeredCount = await db.reservationGuest.count({
    where: {
      reservationId,
      status: {
        in: [
          ReservationGuestStatus.REGISTERED,
          ReservationGuestStatus.VERIFIED,
          ReservationGuestStatus.CHECKED_IN,
          ReservationGuestStatus.CHECKED_OUT,
        ],
      },
    },
  });

  const emailEnrichment = await loadEmailEnrichmentForReservation(
    reservationId,
    reservation.platform,
  );

  const resolution = resolveGuestRegistrationCapacity({
    platform: reservation.platform,
    adults: reservation.adults,
    children: reservation.children,
    infants: reservation.infants,
    propertyMaxGuests: reservation.property.maxGuests,
    guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
    registeredCount,
    emailEnrichment,
  });

  if (!resolution.shouldReconcileDb || !resolution.reconciledOccupancy) {
    return { reconciled: false, reason: resolution.reconcileReason };
  }

  await db.reservation.update({
    where: { id: reservationId },
    data: {
      adults: resolution.reconciledOccupancy.adults,
      children: resolution.reconciledOccupancy.children,
      infants: resolution.reconciledOccupancy.infants,
    },
  });

  return {
    reconciled: true,
    reason: resolution.reconcileReason,
  };
}

/** Fallback síncrono para admin UI sin enrichment async. */
export function resolveGuestRegistrationMaxCapacitySync(
  input: GuestRegistrationCapacityContext,
): number {
  if (input.emailEnrichment) {
    return resolveGuestRegistrationCapacity(input).maxCapacity;
  }
  return getGuestRegistrationMaxCapacity(input);
}
