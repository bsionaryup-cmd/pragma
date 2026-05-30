export type ResolvedGuestCounts = {
  adults: number;
  children: number;
  infants: number;
};

export type GuestCountEnrichment = {
  adultCount?: number | null;
  childCount?: number | null;
  infantCount?: number | null;
  guestCountTotal?: number | null;
};

export function isDefaultReservationOccupancy(
  adults: number,
  children: number,
  infants: number,
): boolean {
  return adults === 1 && children === 0 && infants === 0;
}

/** Prefer email enrichment when iCal left the default 1/0/0 placeholder. */
export function resolveReservationGuestCounts(input: {
  adults: number;
  children: number;
  infants: number;
  enrichment?: GuestCountEnrichment | null;
  registeredGuestCount?: number;
}): ResolvedGuestCounts {
  const enrichment = input.enrichment;

  if (enrichment?.adultCount != null && enrichment.adultCount > 0) {
    return {
      adults: enrichment.adultCount,
      children: Math.max(0, enrichment.childCount ?? 0),
      infants: Math.max(0, enrichment.infantCount ?? 0),
    };
  }

  if (isDefaultReservationOccupancy(input.adults, input.children, input.infants)) {
    if (enrichment?.guestCountTotal != null && enrichment.guestCountTotal > 0) {
      return {
        adults: enrichment.guestCountTotal,
        children: 0,
        infants: 0,
      };
    }

    if (
      input.registeredGuestCount != null &&
      input.registeredGuestCount > input.adults
    ) {
      return {
        adults: input.registeredGuestCount,
        children: 0,
        infants: 0,
      };
    }
  }

  return {
    adults: input.adults,
    children: input.children,
    infants: input.infants,
  };
}

export function totalResolvedGuests(counts: ResolvedGuestCounts): number {
  return counts.adults + counts.children + counts.infants;
}
