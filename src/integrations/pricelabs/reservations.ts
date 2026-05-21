/**
 * Future: reservation sync with PriceLabs.
 */

export type PriceLabsReservationSyncInput = {
  listingId: string;
};

export async function syncPriceLabsReservations(
  _input: PriceLabsReservationSyncInput,
): Promise<{ ok: false; message: string }> {
  return {
    ok: false,
    message: "PriceLabs reservations sync no implementado (MVP)",
  };
}
