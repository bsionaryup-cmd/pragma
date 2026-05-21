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
