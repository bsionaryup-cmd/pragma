import { getPriceLabsPmsName } from "@/lib/integrations/pricelabs-config";
import { priceLabsRequest } from "@/integrations/pricelabs/client";
import { normalizeListingPricesResponse } from "@/integrations/pricelabs/normalize";
import { isBenignListingError } from "@/integrations/pricelabs/normalize";
import type {
  PriceLabsListingPricesRequest,
  PriceLabsListingPricesRow,
  PriceLabsResult,
} from "@/integrations/pricelabs/types";

/** POST /v1/listing_prices — dynamic calendar pricing. */
export async function fetchPriceLabsListingPrices(input: {
  listings: Array<{ id: string; dateFrom: string; dateTo: string }>;
}): Promise<PriceLabsResult<PriceLabsListingPricesRow[]>> {
  const body: PriceLabsListingPricesRequest = {
    listings: input.listings.map((l) => ({
      id: l.id,
      pms: getPriceLabsPmsName(),
      date_from: l.dateFrom,
      date_to: l.dateTo,
      reason: true,
    })),
  };

  const result = await priceLabsRequest<unknown>("/v1/listing_prices", {
    method: "POST",
    body,
    retryable: true,
  });
  if (!result.ok) return result;
  return { ok: true, data: normalizeListingPricesResponse(result.data) };
}

export function isSkippedListingPriceRow(row: PriceLabsListingPricesRow): boolean {
  return isBenignListingError(row.code, row.error);
}
