import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractGuestNameFromReservationEmailEvent } from "../../src/services/reservations/airbnb-display-guest-name.service";

describe("extractGuestNameFromReservationEmailEvent", () => {
  it("uses enrichedFields only and ignores payload.signals", () => {
    const name = extractGuestNameFromReservationEmailEvent({
      enrichedFields: { guestName: "Karla Durán" },
      payload: {
        signals: { guestName: "Yuly Correa" },
      },
    });
    assert.equal(name, "Karla Durán");
  });

  it("returns null when enrichedFields has no displayable guestName even if payload has one", () => {
    const name = extractGuestNameFromReservationEmailEvent({
      enrichedFields: {},
      payload: {
        signals: { guestName: "Yuly Correa" },
      },
    });
    assert.equal(name, null);
  });
});
