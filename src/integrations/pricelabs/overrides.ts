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
  pms?: string,
): Promise<PriceLabsResult<unknown>> {
  const body: Record<string, unknown> = { overrides };
  if (pms?.trim()) body.pms = pms.trim();
  return priceLabsRequest<unknown>(
    `/v1/listings/${encodeURIComponent(listingId)}/overrides`,
    { method: "POST", body, retryable: false },
  );
}

export async function deletePriceLabsOverrides(
  listingId: string,
  dates: string[],
  pms?: string,
): Promise<PriceLabsResult<unknown>> {
  const body: Record<string, unknown> = { dates };
  if (pms?.trim()) body.pms = pms.trim();
  return priceLabsRequest<unknown>(
    `/v1/listings/${encodeURIComponent(listingId)}/overrides`,
    { method: "DELETE", body, retryable: false },
  );
}
