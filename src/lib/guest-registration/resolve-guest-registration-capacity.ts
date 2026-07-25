import type { BookingPlatform } from "@prisma/client";
import type { GuestCountEnrichment } from "@/lib/reservations/display-guest-count";
import { isDefaultReservationOccupancy } from "@/lib/reservations/display-guest-count";
import type { GuestRegistrationCapacityInput } from "@/lib/guest-registration/guest-registration-capacity";

export type ResolvedGuestRegistrationCapacity = {
  /** Huéspedes requeridos para completar registro (adultos + niños). */
  maxCapacity: number;
  /** Ocupación usada para el límite (antes de cap). */
  resolvedOccupancy: number;
  /** Columnas actuales en reserva. */
  dbOccupancy: number;
  /** Ocupación derivada del último email Airbnb (si aplica). */
  enrichmentOccupancy: number | null;
  /** Desglose recomendado para reconciliar DB. */
  reconciledOccupancy: {
    adults: number;
    children: number;
    infants: number;
  } | null;
  shouldReconcileDb: boolean;
  reconcileReason: string | null;
};

export type ResolveGuestRegistrationCapacityInput = GuestRegistrationCapacityInput & {
  emailEnrichment?: GuestCountEnrichment | null;
};

function dbOccupancyFromInput(input: {
  adults: number;
  children: number;
}): number {
  return Math.max(0, input.adults) + Math.max(0, input.children);
}

/** Ocupación operativa de registro a partir de señales de email. */
export function occupancyFromEmailEnrichment(
  enrichment: GuestCountEnrichment | null | undefined,
): { adults: number; children: number; infants: number; total: number } | null {
  if (!enrichment) return null;

  const adultCount = enrichment.adultCount ?? null;
  const childCount = enrichment.childCount ?? null;
  const infantCount = enrichment.infantCount ?? null;

  if (adultCount != null && adultCount > 0) {
    const adults = adultCount;
    const children = Math.max(0, childCount ?? 0);
    const infants = Math.max(0, infantCount ?? 0);
    return { adults, children, infants, total: adults + children };
  }

  const guestTotal = enrichment.guestCountTotal ?? null;
  if (guestTotal != null && guestTotal > 0) {
    return {
      adults: guestTotal,
      children: 0,
      infants: 0,
      total: guestTotal,
    };
  }

  return null;
}

function capOccupancy(
  occupancy: number,
  propertyMaxGuests: number | null | undefined,
): number {
  if (propertyMaxGuests != null && propertyMaxGuests > 0) {
    return Math.min(occupancy, propertyMaxGuests);
  }
  return occupancy;
}

function isInflatedDbOccupancy(input: {
  dbOccupancy: number;
  propertyMaxGuests: number | null | undefined;
  enrichmentTotal: number | null;
  registeredCount?: number;
}): boolean {
  const { dbOccupancy, propertyMaxGuests, enrichmentTotal, registeredCount } =
    input;

  if (propertyMaxGuests != null && propertyMaxGuests > 0 && dbOccupancy > propertyMaxGuests) {
    return true;
  }

  if (enrichmentTotal != null && dbOccupancy > enrichmentTotal) {
    return true;
  }

  if (
    registeredCount != null &&
    registeredCount > 0 &&
    dbOccupancy > registeredCount &&
    dbOccupancy >= registeredCount + 3
  ) {
    return true;
  }

  return false;
}

/**
 * Resuelve capacidad de registro sin side-effects.
 * Prioriza columnas de reserva salvo placeholder iCal, inflación vs propiedad/email,
 * o progreso de huéspedes ya registrados frente a un DB claramente erróneo.
 */
export function resolveGuestRegistrationCapacity(
  input: ResolveGuestRegistrationCapacityInput,
): ResolvedGuestRegistrationCapacity {
  const dbOccupancy = dbOccupancyFromInput(input);
  const enrichmentParsed = occupancyFromEmailEnrichment(input.emailEnrichment);
  const enrichmentOccupancy = enrichmentParsed?.total ?? null;

  const placeholder = isDefaultReservationOccupancy(
    input.adults,
    input.children,
    input.infants,
  );

  let chosenOccupancy = dbOccupancy;
  let reconcileReason: string | null = null;

  if (placeholder && enrichmentOccupancy != null) {
    chosenOccupancy = enrichmentOccupancy;
    reconcileReason = "ical_placeholder_email_enrichment";
  } else if (
    enrichmentOccupancy != null &&
    isInflatedDbOccupancy({
      dbOccupancy,
      propertyMaxGuests: input.propertyMaxGuests,
      enrichmentTotal: enrichmentOccupancy,
      registeredCount: input.registeredCount,
    })
  ) {
    chosenOccupancy = enrichmentOccupancy;
    reconcileReason = "db_inflated_vs_email_or_property";
  } else if (
    input.registeredCount != null &&
    input.registeredCount > 0 &&
    enrichmentOccupancy != null &&
    enrichmentOccupancy >= input.registeredCount &&
    enrichmentOccupancy < dbOccupancy
  ) {
    chosenOccupancy = enrichmentOccupancy;
    reconcileReason = "registration_progress_vs_inflated_db";
  } else if (
    input.propertyMaxGuests != null &&
    input.propertyMaxGuests > 0 &&
    dbOccupancy > input.propertyMaxGuests
  ) {
    chosenOccupancy = input.propertyMaxGuests;
    reconcileReason = "db_exceeds_property_max";
  }

  const cappedOccupancy = capOccupancy(chosenOccupancy, input.propertyMaxGuests);
  const resolvedMaxCapacity = Math.max(1, cappedOccupancy);

  let reconciledOccupancy: ResolvedGuestRegistrationCapacity["reconciledOccupancy"] =
    null;
  if (reconcileReason && enrichmentParsed) {
    reconciledOccupancy = {
      adults: enrichmentParsed.adults,
      children: enrichmentParsed.children,
      infants: enrichmentParsed.infants,
    };
  } else if (reconcileReason === "db_exceeds_property_max") {
    const adults = Math.min(input.adults, input.propertyMaxGuests ?? input.adults);
    reconciledOccupancy = {
      adults: Math.max(1, adults),
      children: Math.max(0, Math.min(input.children, (input.propertyMaxGuests ?? adults) - adults)),
      infants: Math.max(0, input.infants),
    };
  }

  const shouldReconcileDb =
    Boolean(reconcileReason) &&
    !input.guestRegistrationCompletedAt &&
    reconciledOccupancy != null &&
    (reconciledOccupancy.adults !== input.adults ||
      reconciledOccupancy.children !== input.children ||
      reconciledOccupancy.infants !== input.infants);

  return {
    maxCapacity: resolvedMaxCapacity,
    resolvedOccupancy: cappedOccupancy,
    dbOccupancy,
    enrichmentOccupancy,
    reconciledOccupancy,
    shouldReconcileDb,
    reconcileReason,
  };
}

export function isAirbnbGuestRegistrationCapacityPlatform(
  platform: BookingPlatform,
): boolean {
  return platform === "AIRBNB";
}
