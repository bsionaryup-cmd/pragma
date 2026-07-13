import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveReservationGuestCounts } from "@/lib/reservations/display-guest-count";

describe("resolveReservationGuestCounts", () => {
  it("returns reservation columns as SSOT", () => {
    assert.deepEqual(
      resolveReservationGuestCounts({
        adults: 4,
        children: 1,
        infants: 0,
        enrichment: {
          adultCount: 1,
          childCount: 0,
          guestCountTotal: 1,
        },
      }),
      { adults: 4, children: 1, infants: 0 },
    );
  });

  it("does not overlay email enrichment on iCal placeholder", () => {
    assert.deepEqual(
      resolveReservationGuestCounts({
        adults: 1,
        children: 0,
        infants: 0,
        enrichment: { adultCount: 4, guestCountTotal: 4 },
      }),
      { adults: 1, children: 0, infants: 0 },
    );
  });
});
