import type {
  PriceLabsListingPayload,
  PragmaPropertyForPriceLabs,
} from "@/integrations/pricelabs/types";

function parseDecimal(value: { toString(): string } | null): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value.toString());
  return Number.isFinite(n) ? n : null;
}

/** PRAGMA property → PriceLabs listing payload (no DB access). */
export function mapPropertyToPriceLabsListing(
  property: PragmaPropertyForPriceLabs,
): PriceLabsListingPayload {
  const basePrice = parseDecimal(property.baseRate);
  const bathrooms = Number.parseFloat(property.bathrooms.toString());

  return {
    listing_id: property.id,
    name: property.name,
    capacity: {
      guests: property.maxGuests,
      bedrooms: property.bedrooms,
      bathrooms: Number.isFinite(bathrooms) ? bathrooms : 1,
    },
    location: {
      address: property.address,
      city: property.city,
      country: property.country,
      latitude: null,
      longitude: null,
    },
    pricing: {
      base_price: basePrice,
      currency: property.currency,
    },
    metadata: {
      source: "pragma-pms",
      pragma_property_id: property.id,
    },
  };
}

export function mapPropertiesToPriceLabsListings(
  properties: PragmaPropertyForPriceLabs[],
): PriceLabsListingPayload[] {
  return properties.map(mapPropertyToPriceLabsListing);
}
