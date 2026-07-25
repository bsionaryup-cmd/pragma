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
  });

  it("caps DB occupancy at property maxGuests when no enrichment", () => {
    const result = resolveGuestRegistrationCapacity({
      platform: BookingPlatform.DIRECT,
      adults: 13,
      children: 0,
      infants: 0,
      propertyMaxGuests: 4,
    });
    assert.equal(result.maxCapacity, 4);
    assert.equal(result.reconcileReason, "db_exceeds_property_max");
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
