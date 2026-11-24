import { priceLabsRequest } from "@/integrations/pricelabs/client";
import { normalizeListingCustomizations } from "@/integrations/pricelabs/normalize";
import type {
  PriceLabsListingCustomizations,
  PriceLabsResult,
} from "@/integrations/pricelabs/types";

export { normalizeListingCustomizations };

/**
 * Read listing-level customizations.
 * Pass toggledOn=false to also receive toggled-off packs (needed for admin UI).
 */
export async function fetchListingCustomizations(input: {
  listingId: string;
  pmsName: string;
  toggledOn?: boolean;
  keys?: string[];
}): Promise<PriceLabsResult<PriceLabsListingCustomizations>> {
  const params = new URLSearchParams({
    listing_id: input.listingId,
    pms_name: input.pmsName,
  });
  if (input.toggledOn === false) {
    params.set("toggled_on", "false");
  }
  if (input.keys?.length) {
    params.set("customizations", input.keys.join(","));
  }

  const result = await priceLabsRequest<unknown>(
    `/v1/customizations/listing?${params.toString()}`,
    { method: "GET", retryable: true },
  );
  if (!result.ok) return result;
  return { ok: true, data: normalizeListingCustomizations(result.data) };
}

/**
 * Atomic write of one or more listing customizations.
 * Unknown keys are rejected by PriceLabs — only send supported specs.
 */
export async function updateListingCustomizations(input: {
  listingId: string;
  pmsName: string;
  customizations: PriceLabsListingCustomizations;
}): Promise<
  PriceLabsResult<{ status?: string; applied?: string[] }>
> {
  const result = await priceLabsRequest<{
    status?: string;
    applied?: string[];
  }>("/v1/customizations/listing", {
    method: "POST",
    body: {
      listing_id: input.listingId,
      pms_name: input.pmsName,
      customizations: input.customizations,
    },
    retryable: false,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data ?? {} };
}
