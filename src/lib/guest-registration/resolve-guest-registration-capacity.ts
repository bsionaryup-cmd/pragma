import type { BookingPlatform } from "@prisma/client";
import type { GuestCountEnrichment } from "@/lib/reservations/display-guest-count";
import { isDefaultReservationOccupancy } from "@/lib/reservations/display-guest-count";
import type { GuestRegistrationCapacityInput } from "@/lib/guest-registration/guest-registration-capacity";

export type ResolvedGuestRegistrationCapacity = {
  /** Huéspedes requeridos para completar registro (adultos + niños + bebés). */
  maxCapacity: number;
  /** Ocupación usada para el límite (adults + children + infants resueltos). */
  resolvedOccupancy: number;
  /** Columnas actuales en reserva (adults + children + infants). */
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
  infants: number;
}): number {
  return (
    Math.max(0, input.adults) +
    Math.max(0, input.children) +
    Math.max(0, input.infants)
  );
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
    return { adults, children, infants, total: adults + children + infants };
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

function isInflatedDbOccupancy(input: {
  dbOccupancy: number;
  enrichmentTotal: number | null;
  registeredCount?: number;
}): boolean {
  const { dbOccupancy, enrichmentTotal, registeredCount } = input;

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
 * SSOT: adults + children + infants de la reserva (con enrich Airbnb para
 * placeholder iCal o DB inflada vs email). Nunca usa Property.maxGuests como techo.
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
      enrichmentTotal: enrichmentOccupancy,
      registeredCount: input.registeredCount,
    })
  ) {
    chosenOccupancy = enrichmentOccupancy;
    reconcileReason = "db_inflated_vs_email";
  } else if (
    input.registeredCount != null &&
    input.registeredCount > 0 &&
    enrichmentOccupancy != null &&
    enrichmentOccupancy >= input.registeredCount &&
    enrichmentOccupancy < dbOccupancy
  ) {
    chosenOccupancy = enrichmentOccupancy;
    reconcileReason = "registration_progress_vs_inflated_db";
  }

  const resolvedOccupancy = chosenOccupancy;
  const resolvedMaxCapacity = Math.max(1, resolvedOccupancy);

  let reconciledOccupancy: ResolvedGuestRegistrationCapacity["reconciledOccupancy"] =
    null;
  if (reconcileReason && enrichmentParsed) {
    reconciledOccupancy = {
      adults: enrichmentParsed.adults,
      children: enrichmentParsed.children,
      infants: enrichmentParsed.infants,
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
    resolvedOccupancy,
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
