import { fetchPriceLabsListings } from "@/integrations/pricelabs/listings";
import type { PriceLabsResult } from "@/integrations/pricelabs/types";

export type PriceLabsHealthCheck = {
  healthy: boolean;
  label: string;
  listingCount: number;
};

/** Reachability via GET /v1/listings (official Customer API). */
export async function checkPriceLabsReachability(): Promise<
  PriceLabsResult<PriceLabsHealthCheck>
> {
  const result = await fetchPriceLabsListings();
  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      status: result.status,
      code: result.code,
    };
  }
  const count = result.data.length;
  return {
    ok: true,
    data: {
      healthy: true,
      label: count > 0 ? "Saludable" : "Sin listings",
      listingCount: count,
    },
  };
}
