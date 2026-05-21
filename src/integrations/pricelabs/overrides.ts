import { priceLabsRequest } from "@/integrations/pricelabs/client";
import { normalizeOverridesResponse } from "@/integrations/pricelabs/normalize";
import type {
  PriceLabsOverrideRecord,
  PriceLabsResult,
} from "@/integrations/pricelabs/types";

export async function fetchPriceLabsOverrides(
  listingId: string,
): Promise<PriceLabsResult<PriceLabsOverrideRecord[]>> {
  const result = await priceLabsRequest<unknown>(
    `/v1/listings/${encodeURIComponent(listingId)}/overrides`,
    { method: "GET", retryable: true },
  );
  if (!result.ok) return result;
  return { ok: true, data: normalizeOverridesResponse(result.data) };
}

export async function upsertPriceLabsOverrides(
  listingId: string,
  overrides: PriceLabsOverrideRecord[],
): Promise<PriceLabsResult<unknown>> {
  return priceLabsRequest<unknown>(
    `/v1/listings/${encodeURIComponent(listingId)}/overrides`,
    { method: "POST", body: { overrides }, retryable: false },
  );
}

export async function deletePriceLabsOverrides(
  listingId: string,
  dates: string[],
): Promise<PriceLabsResult<unknown>> {
  return priceLabsRequest<unknown>(
    `/v1/listings/${encodeURIComponent(listingId)}/overrides`,
    { method: "DELETE", body: { dates }, retryable: false },
  );
}
