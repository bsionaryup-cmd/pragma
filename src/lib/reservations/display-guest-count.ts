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

/** Reservation columns are the SSOT for displayed occupancy. */
export function resolveReservationGuestCounts(input: {
  adults: number;
  children: number;
  infants: number;
  /** @deprecated Email events are not used as occupancy fallback. */
  enrichment?: GuestCountEnrichment | null;
  registeredGuestCount?: number;
}): ResolvedGuestCounts {
  return {
    adults: input.adults,
    children: input.children,
    infants: input.infants,
  };
}

export function totalResolvedGuests(counts: ResolvedGuestCounts): number {
  return counts.adults + counts.children + counts.infants;
}
