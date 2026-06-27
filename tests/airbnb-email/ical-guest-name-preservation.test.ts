import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReservationStatus, BookingPlatform } from "@prisma/client";
import { buildIcalSyncReservationUpdate } from "@/services/airbnb/ical-guest-name-sync";

describe("buildIcalSyncReservationUpdate guest name preservation", () => {
  const payload = {
    guestName: "Different Airbnb Name",
    guestFirstName: "Different",
    guestLastName: "Airbnb Name",
    checkIn: new Date("2026-07-01"),
    checkOut: new Date("2026-07-05"),
    status: ReservationStatus.CONFIRMED,
    platform: BookingPlatform.AIRBNB,
  };

  it("never replaces a real enriched guest name from iCal", () => {
    const update = buildIcalSyncReservationUpdate(payload, {
      guestName: "Margarita Guillen Villafuerte",
      guestRegistrationCompletedAt: null,
    });

    assert.equal("guestName" in update, false);
    assert.equal("guestFirstName" in update, false);
    assert.equal(update.checkIn, payload.checkIn);
  });

  it("still fills placeholder names from iCal", () => {
    const update = buildIcalSyncReservationUpdate(payload, {
      guestName: "Huésped Airbnb",
      guestRegistrationCompletedAt: null,
    });

    assert.equal(update.guestName, payload.guestName);
    assert.equal(update.guestFirstName, payload.guestFirstName);
  });

  it("skips guest fields when registration is complete", () => {
    const update = buildIcalSyncReservationUpdate(payload, {
      guestName: "Huésped Airbnb",
      guestRegistrationCompletedAt: new Date(),
    });

    assert.equal("guestName" in update, false);
    assert.equal(update.status, payload.status);
  });
});
