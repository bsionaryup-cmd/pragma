import type {
  PriceLabsListingRecord,
  PragmaPropertyForPriceLabs,
  PropertyListingMatch,
} from "@/integrations/pricelabs/types";

const MIN_FUZZY_SCORE = 0.35;

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** PriceLabs titles often prefix with "APTO 801--APTO 801 · …" */
function extractMatchableName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.includes("·")) {
    return normalizeKey(trimmed.split("·").pop() ?? trimmed);
  }
  if (trimmed.includes("--")) {
    const afterDash = trimmed.split("--").pop() ?? trimmed;
    return normalizeKey(afterDash.replace(/^[^·]+·\s*/, ""));
  }
  return normalizeKey(trimmed);
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeKey(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2),
  );
}

function similarityScore(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) {
    if (tb.has(token)) intersection += 1;
  }
  return intersection / Math.max(ta.size, tb.size);
}

function isStaleStoredListingId(
  storedListingId: string | undefined,
  listings: PriceLabsListingRecord[],
): boolean {
  if (!storedListingId) return false;
  if (listings.some((listing) => listing.id === storedListingId)) return false;
  // Dry-run / legacy rows stored PRAGMA property ids instead of PriceLabs ids.
  return /^c[a-z0-9]{20,}$/i.test(storedListingId);
}

function scorePropertyListingPair(
  property: PragmaPropertyForPriceLabs,
  listing: PriceLabsListingRecord,
): number {
  const propertyName = extractMatchableName(property.name);
  const listingName = listing.name
    ? extractMatchableName(listing.name)
    : "";

  let score = similarityScore(propertyName, listingName);
  if (listingName.includes(propertyName) || propertyName.includes(listingName)) {
    score = Math.max(score, 0.72);
  }

  const propertyCity = normalizeKey(property.city);
  const listingCity = listing.city ? normalizeKey(listing.city) : "";
  if (propertyCity && listingCity) {
    if (propertyCity === listingCity) score += 0.12;
    else if (
      propertyCity.includes(listingCity) ||
      listingCity.includes(propertyCity)
    ) {
      score += 0.06;
    } else {
      score -= 0.08;
    }
  }

  if (
    property.bedrooms != null &&
    listing.bedrooms != null &&
    property.bedrooms === listing.bedrooms
  ) {
    score += 0.05;
  }

  return score;
}

/** Match PriceLabs listings ↔ PRAGMA active properties. */
export function matchListingsToProperties(input: {
  listings: PriceLabsListingRecord[];
  properties: PragmaPropertyForPriceLabs[];
  existingListingByPropertyId?: Map<string, string>;
}): PropertyListingMatch[] {
  const matches: PropertyListingMatch[] = [];
  const usedListingIds = new Set<string>();
  const unmatchedProperties: PragmaPropertyForPriceLabs[] = [];

  for (const property of input.properties) {
    const storedListingId = input.existingListingByPropertyId?.get(
      property.id,
    );
    const ignoreStored = isStaleStoredListingId(
      storedListingId,
      input.listings,
    );

    let match: PropertyListingMatch | null = null;

    if (storedListingId && !ignoreStored) {
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
      const nameKey = extractMatchableName(property.name);
      const cityKey = normalizeKey(property.city);
      const exact = input.listings.find((listing) => {
        if (usedListingIds.has(listing.id)) return false;
        const listingName = listing.name
          ? extractMatchableName(listing.name)
          : "";
        const listingCity = listing.city ? normalizeKey(listing.city) : "";
        return (
          listingName === nameKey && (!listingCity || listingCity === cityKey)
        );
      });
      if (exact) {
        match = {
          propertyId: property.id,
          listingId: exact.id,
          listing: exact,
          matchReason: "name_city",
        };
      }
    }

    if (match) {
      usedListingIds.add(match.listingId);
      matches.push(match);
    } else {
      unmatchedProperties.push(property);
    }
  }

  if (unmatchedProperties.length === 0) return matches;

  const candidatePairs: Array<{
    property: PragmaPropertyForPriceLabs;
    listing: PriceLabsListingRecord;
    score: number;
  }> = [];

  for (const property of unmatchedProperties) {
    for (const listing of input.listings) {
      if (usedListingIds.has(listing.id)) continue;
      const score = scorePropertyListingPair(property, listing);
      if (score >= MIN_FUZZY_SCORE) {
        candidatePairs.push({ property, listing, score });
      }
    }
  }

  candidatePairs.sort((a, b) => b.score - a.score);

  const matchedPropertyIds = new Set<string>();

  for (const candidate of candidatePairs) {
    if (
      matchedPropertyIds.has(candidate.property.id) ||
      usedListingIds.has(candidate.listing.id)
    ) {
      continue;
    }

    matchedPropertyIds.add(candidate.property.id);
    usedListingIds.add(candidate.listing.id);
    matches.push({
      propertyId: candidate.property.id,
      listingId: candidate.listing.id,
      listing: candidate.listing,
      matchReason: "fuzzy",
    });
  }

  return matches;
}

/** Debe cubrir el horizonte del calendario (CALENDAR_DAYS_AFTER + margen). */
export const PRICELABS_PRICING_WINDOW_DAYS = 134;

export function buildPricingDateRange(days = PRICELABS_PRICING_WINDOW_DAYS): {
  dateFrom: string;
  dateTo: string;
} {
  const from = new Date();
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + days - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}
