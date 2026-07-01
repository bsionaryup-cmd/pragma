import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { getGuestRegistrationMaxCapacity } from "@/lib/guest-registration/guest-registration-capacity";

describe("getGuestRegistrationMaxCapacity", () => {
  it("limits Airbnb registration to adults + children from reservation", () => {
    const capacity = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 2,
      children: 1,
      infants: 0,
      propertyMaxGuests: 8,
    });
    assert.equal(capacity, 3);
  });

  it("does not expand to property max when iCal is still 1/0/0", () => {
    const capacity = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 1,
      children: 0,
      infants: 0,
      propertyMaxGuests: 8,
    });
    assert.equal(capacity, 1);
  });

  it("uses enriched guest total when iCal placeholder is 1/0/0", () => {
    const capacity = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 1,
      children: 0,
      infants: 0,
      guestCountTotal: 3,
      propertyMaxGuests: 8,
    });
    assert.equal(capacity, 3);
  });

  it("uses enriched adult and child breakdown when available", () => {
    const capacity = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 1,
      children: 0,
      infants: 0,
      enrichedAdultCount: 2,
      enrichedChildCount: 1,
      propertyMaxGuests: 10,
    });
    assert.equal(capacity, 3);
  });

  it("never allows more guests than reservation occupancy for direct bookings", () => {
    const capacity = getGuestRegistrationMaxCapacity({
      platform: BookingPlatform.DIRECT,
      adults: 2,
      children: 0,
      infants: 0,
      propertyMaxGuests: 12,
    });
    assert.equal(capacity, 2);
  });
});
