import { priceLabsRequest } from "@/integrations/pricelabs/client";
import type {
  PriceLabsGetPricesRequest,
  PriceLabsGetPricesResponse,
  PriceLabsPriceRecommendation,
  PriceLabsResult,
} from "@/integrations/pricelabs/types";

export async function fetchPriceLabsPrices(input: {
  listingIds: string[];
  startDate?: string;
  endDate?: string;
  userTokenOverride?: string | null;
}): Promise<PriceLabsResult<PriceLabsGetPricesResponse>> {
  const body: PriceLabsGetPricesRequest = {
    listing_ids: input.listingIds,
    ...(input.startDate ? { start_date: input.startDate } : {}),
    ...(input.endDate ? { end_date: input.endDate } : {}),
  };

  return priceLabsRequest<PriceLabsGetPricesResponse>("/get_prices", {
    method: "POST",
    body,
    userTokenOverride: input.userTokenOverride,
    retryable: false,
  });
}

export function extractPriceRecommendations(
  data: PriceLabsGetPricesResponse,
): PriceLabsPriceRecommendation[] {
  if (Array.isArray(data.prices)) return data.prices;
  if (Array.isArray(data.recommendations)) return data.recommendations;
  return [];
}
