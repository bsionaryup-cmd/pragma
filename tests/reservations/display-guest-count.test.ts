import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveReservationGuestCounts } from "@/lib/reservations/display-guest-count";

describe("resolveReservationGuestCounts", () => {
  it("uses email breakdown when iCal left the default 1/0/0 placeholder", () => {
    assert.deepEqual(
      resolveReservationGuestCounts({
        adults: 1,
        children: 0,
        infants: 0,
        enrichment: {
          adultCount: 2,
          childCount: 1,
          infantCount: 0,
          guestCountTotal: 3,
        },
      }),
      { adults: 2, children: 1, infants: 0 },
    );
  });

  it("uses guestCountTotal when only total is available", () => {
    assert.deepEqual(
      resolveReservationGuestCounts({
        adults: 1,
        children: 0,
        infants: 0,
        enrichment: { guestCountTotal: 4 },
      }),
      { adults: 4, children: 0, infants: 0 },
    );
  });

  it("keeps manual reservation counts when they are not the default placeholder", () => {
    assert.deepEqual(
      resolveReservationGuestCounts({
        adults: 3,
        children: 1,
        infants: 0,
        enrichment: { guestCountTotal: 4 },
      }),
      { adults: 3, children: 1, infants: 0 },
    );
  });
});
