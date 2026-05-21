import type {
  PriceLabsListingPayload,
  PragmaPropertyForPriceLabs,
} from "@/integrations/pricelabs/types";

function parseDecimal(value: { toString(): string } | null): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value.toString());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function clampPositiveInt(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sanitizeListingId(id: string): string {
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : "unknown-listing";
}

function sanitizeText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/** PRAGMA property → PriceLabs listing payload (no DB access). */
export function mapPropertyToPriceLabsListing(
  property: PragmaPropertyForPriceLabs,
): PriceLabsListingPayload {
  const basePrice = parseDecimal(property.baseRate);
  const bathrooms = Number.parseFloat(property.bathrooms.toString());

  return {
    listing_id: sanitizeListingId(property.id),
    name: sanitizeText(property.name, "PRAGMA listing"),
    capacity: {
      guests: clampPositiveInt(property.maxGuests, 1),
      bedrooms: clampPositiveInt(property.bedrooms, 1),
      bathrooms: Number.isFinite(bathrooms) && bathrooms > 0 ? bathrooms : 1,
    },
    location: {
      address: sanitizeText(property.address, "—"),
      city: sanitizeText(property.city, "—"),
      country: sanitizeText(property.country, "CO"),
      latitude: null,
      longitude: null,
    },
    pricing: {
      base_price: basePrice,
      currency: sanitizeText(property.currency, "COP"),
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
