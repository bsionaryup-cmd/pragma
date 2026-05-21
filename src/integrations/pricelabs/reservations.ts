/**
 * Future: reservation sync with PriceLabs.
 */

export type PriceLabsReservationSyncInput = {
  listingId: string;
};

export async function syncPriceLabsReservations(
  input: PriceLabsReservationSyncInput,
): Promise<{ ok: false; message: string }> {
  void input;
  return {
    ok: false,
    message: "PriceLabs reservations sync no implementado (MVP)",
  };
}
