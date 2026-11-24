import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { resolveGuestRegistrationCapacity } from "@/lib/guest-registration/resolve-guest-registration-capacity";

describe("resolveGuestRegistrationCapacity", () => {
  it("uses email enrichment when iCal placeholder is 1/0/0", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 1,
      children: 0,
      infants: 0,
      propertyMaxGuests: 8,
      emailEnrichment: { adultCount: 2, childCount: 1, infantCount: 0, guestCountTotal: 3 },
    });
    assert.equal(result.maxCapacity, 3);
    assert.equal(result.shouldReconcileDb, true);
    assert.equal(result.reconcileReason, "ical_placeholder_email_enrichment");
  });

  it("lowers inflated DB occupancy when email says fewer guests (3/13 case)", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 13,
      children: 0,
      infants: 0,
      propertyMaxGuests: 13,
      registeredCount: 3,
      emailEnrichment: { adultCount: 3, childCount: 0, infantCount: 0, guestCountTotal: 3 },
    });
    assert.equal(result.maxCapacity, 3);
    assert.equal(result.shouldReconcileDb, true);
    assert.equal(result.reconcileReason, "db_inflated_vs_email");
  });

  it("does not cap reservation occupancy at property maxGuests without enrichment", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.DIRECT,
      adults: 13,
      children: 0,
      infants: 0,
      propertyMaxGuests: 4,
    });
    assert.equal(result.maxCapacity, 13);
    assert.equal(result.reconcileReason, null);
    assert.equal(result.shouldReconcileDb, false);
  });

  it("keeps reservation occupancy when it exceeds property maxGuests (5 on loft of 4)", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 5,
      children: 0,
      infants: 0,
      propertyMaxGuests: 4,
      emailEnrichment: { adultCount: 5, childCount: 0, infantCount: 0, guestCountTotal: 5 },
    });
    assert.equal(result.maxCapacity, 5);
    assert.equal(result.shouldReconcileDb, false);
  });

  for (const n of [1, 2, 3, 4, 5, 6, 8] as const) {
    it(`resolves maxCapacity=${n} from reservation adults without property cap`, () => {
      const result = resolveGuestRegistrationCapacity({
        platform: BookingPlatform.DIRECT,
        adults: n,
        children: 0,
        infants: 0,
        propertyMaxGuests: 4,
      });
      assert.equal(result.maxCapacity, n);
    });
  }

  it("includes children and infants in registration capacity", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.DIRECT,
      adults: 2,
      children: 2,
      infants: 1,
      propertyMaxGuests: 4,
    });
    assert.equal(result.maxCapacity, 5);
  });

  it("allows 4 adults + 1 infant to register regardless of property maxGuests", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 4,
      children: 0,
      infants: 1,
      propertyMaxGuests: 4,
    });
    assert.equal(result.maxCapacity, 5);
    assert.equal(result.dbOccupancy, 5);
  });

  it("includes infants from email enrichment in registration capacity", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 1,
      children: 0,
      infants: 0,
      propertyMaxGuests: 4,
      emailEnrichment: {
        adultCount: 4,
        childCount: 0,
        infantCount: 1,
        guestCountTotal: 5,
      },
    });
    assert.equal(result.maxCapacity, 5);
    assert.equal(result.reconcileReason, "ical_placeholder_email_enrichment");
  });

  it("does not reconcile when guest registration is already completed", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 13,
      children: 0,
      infants: 0,
      guestRegistrationCompletedAt: new Date(),
      emailEnrichment: { adultCount: 3, childCount: 0, infantCount: 0, guestCountTotal: 3 },
    });
    assert.equal(result.maxCapacity, 3);
    assert.equal(result.shouldReconcileDb, false);
  });

  it("keeps correct DB occupancy when already aligned with email", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.AIRBNB,
      adults: 2,
      children: 1,
      infants: 0,
      propertyMaxGuests: 8,
      emailEnrichment: { adultCount: 2, childCount: 1, infantCount: 0, guestCountTotal: 3 },
    });
    assert.equal(result.maxCapacity, 3);
    assert.equal(result.shouldReconcileDb, false);
  });
});
