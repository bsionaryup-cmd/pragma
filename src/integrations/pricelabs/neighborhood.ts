import { priceLabsRequest } from "@/integrations/pricelabs/client";
import type {
  PriceLabsNeighborhoodResponse,
  PriceLabsResult,
} from "@/integrations/pricelabs/types";

/** GET /v1/neighborhood_data — market intelligence snapshot. */
export async function fetchPriceLabsNeighborhoodData(input?: {
  listingId?: string;
  city?: string;
}): Promise<PriceLabsResult<PriceLabsNeighborhoodResponse>> {
  const params = new URLSearchParams();
  if (input?.listingId) params.set("listing_id", input.listingId);
  if (input?.city) params.set("city", input.city);
  const qs = params.toString();
  const path = qs ? `/v1/neighborhood_data?${qs}` : "/v1/neighborhood_data";

  return priceLabsRequest<PriceLabsNeighborhoodResponse>(path, {
    method: "GET",
    retryable: true,
  });
}
