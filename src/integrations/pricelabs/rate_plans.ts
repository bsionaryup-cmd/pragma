/**
 * Future: rate plan sync with PriceLabs.
 */

export type PriceLabsRatePlanSyncInput = {
  listingId: string;
};

export async function syncPriceLabsRatePlans(
  input: PriceLabsRatePlanSyncInput,
): Promise<{ ok: false; message: string }> {
  void input;
  return {
    ok: false,
    message: "PriceLabs rate plans sync no implementado (MVP)",
  };
}
