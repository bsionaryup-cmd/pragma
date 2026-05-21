/**
 * Future: calendar sync with PriceLabs.
 * @see https://api.pricelabs.co/v1/integration/api — not implemented in MVP.
 */

export type PriceLabsCalendarSyncInput = {
  listingId: string;
  startDate: string;
  endDate: string;
};

export async function syncPriceLabsCalendar(
  _input: PriceLabsCalendarSyncInput,
): Promise<{ ok: false; message: string }> {
  return {
    ok: false,
    message: "PriceLabs calendar sync no implementado (MVP)",
  };
}
