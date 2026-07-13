import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import {
  getGuestRegistrationMaxCapacity,
  getReservationGuestCount,
} from "@/lib/guest-registration/guest-registration-capacity";

describe("guest registration occupancy SSOT", () => {
  it("uses reservation columns only for max capacity", () => {
    const capacity = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 4,
      children: 0,
      infants: 0,
      guestCountTotal: 1,
      enrichedAdultCount: 1,
      enrichedChildCount: 0,
    });
    assert.equal(capacity, 4);
  });

  it("reflects UPDATED sync immediately without email-event fallback", () => {
    const before = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 1,
      children: 0,
      infants: 0,
    });
    const after = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 4,
      children: 0,
      infants: 0,
    });
    assert.equal(before, 1);
    assert.equal(after, 4);
  });

  it("counts adults and children for registration limit, not infants", () => {
    const capacity = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 2,
      children: 1,
      infants: 2,
    });
    assert.equal(capacity, 3);
    assert.equal(
      getReservationGuestCount({ adults: 2, children: 1, infants: 2 }),
      5,
    );
  });

  it("keeps iCal placeholder at 1 until reservation row is enriched", () => {
    const capacity = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 1,
      children: 0,
      infants: 0,
    });
    assert.equal(capacity, 1);
  });
});
