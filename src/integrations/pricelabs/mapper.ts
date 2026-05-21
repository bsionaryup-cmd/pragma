import type {
  PriceLabsListingRecord,
  PragmaPropertyForPriceLabs,
  PropertyListingMatch,
} from "@/integrations/pricelabs/types";

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** Match PriceLabs listings ↔ PRAGMA active properties. */
export function matchListingsToProperties(input: {
  listings: PriceLabsListingRecord[];
  properties: PragmaPropertyForPriceLabs[];
  existingListingByPropertyId?: Map<string, string>;
}): PropertyListingMatch[] {
  const matches: PropertyListingMatch[] = [];
  const usedListingIds = new Set<string>();

  for (const property of input.properties) {
    const storedListingId = input.existingListingByPropertyId?.get(
      property.id,
    );

    let match: PropertyListingMatch | null = null;

    if (storedListingId) {
      const listing = input.listings.find((l) => l.id === storedListingId);
      if (listing && !usedListingIds.has(listing.id)) {
        match = {
          propertyId: property.id,
          listingId: listing.id,
          listing,
          matchReason: "listing_id",
        };
      }
    }

    if (!match) {
      const byPropertyId = input.listings.find(
        (l) => l.id === property.id && !usedListingIds.has(l.id),
      );
      if (byPropertyId) {
        match = {
          propertyId: property.id,
          listingId: byPropertyId.id,
          listing: byPropertyId,
          matchReason: "property_id",
        };
      }
    }

    if (!match) {
      const nameKey = normalizeKey(property.name);
      const cityKey = normalizeKey(property.city);
      const fuzzy = input.listings.find((l) => {
        if (usedListingIds.has(l.id)) return false;
        const lName = l.name ? normalizeKey(l.name) : "";
        const lCity = l.city ? normalizeKey(l.city) : "";
        return lName === nameKey && (!lCity || lCity === cityKey);
      });
      if (fuzzy) {
        match = {
          propertyId: property.id,
          listingId: fuzzy.id,
          listing: fuzzy,
          matchReason: "name_city",
        };
      }
    }

    if (match) {
      usedListingIds.add(match.listingId);
      matches.push(match);
    }
  }

  return matches;
}

export function buildPricingDateRange(days = 90): {
  dateFrom: string;
  dateTo: string;
} {
  const from = new Date();
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + days - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}
