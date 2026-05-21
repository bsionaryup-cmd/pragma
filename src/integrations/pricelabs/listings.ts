import { priceLabsRequest } from "@/integrations/pricelabs/client";
import type {
  PriceLabsListingPayload,
  PriceLabsListingsRequest,
  PriceLabsListingsResponse,
  PriceLabsResult,
} from "@/integrations/pricelabs/types";

export async function pushPriceLabsListings(input: {
  listings: PriceLabsListingPayload[];
  userTokenOverride?: string | null;
}): Promise<PriceLabsResult<PriceLabsListingsResponse>> {
  const body: PriceLabsListingsRequest = { listings: input.listings };
  return priceLabsRequest<PriceLabsListingsResponse>("/listings", {
    method: "POST",
    body,
    userTokenOverride: input.userTokenOverride,
    retryable: false,
  });
}
