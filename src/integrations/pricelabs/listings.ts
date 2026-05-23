import { priceLabsRequest } from "@/integrations/pricelabs/client";
import { normalizeListingsResponse } from "@/integrations/pricelabs/normalize";
import type {
  PriceLabsListingRecord,
  PriceLabsResult,
} from "@/integrations/pricelabs/types";

/** GET /v1/listings — pull account listings from PriceLabs. */
export async function fetchPriceLabsListings(): Promise<
  PriceLabsResult<PriceLabsListingRecord[]>
> {
  const result = await priceLabsRequest<unknown>("/v1/listings", {
    method: "GET",
    retryable: true,
  });
  if (!result.ok) return result;
  return { ok: true, data: normalizeListingsResponse(result.data) };
}

/** Resolve a single listing from account listings. */
export async function fetchPriceLabsListingById(
  listingId: string,
): Promise<PriceLabsResult<PriceLabsListingRecord | null>> {
  const listings = await fetchPriceLabsListings();
  if (!listings.ok) return listings;
  const match = listings.data.find((row) => row.id === listingId) ?? null;
  if (!match) {
    return { ok: false, message: `Listing ${listingId} no encontrado en PriceLabs` };
  }
  return { ok: true, data: match };
}

/** Alias for connection validation. */
export const validatePriceLabsConnection = fetchPriceLabsListings;
