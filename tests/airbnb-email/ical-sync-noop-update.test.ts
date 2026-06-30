import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform, ReservationStatus } from "@prisma/client";
import {
  buildIcalSyncReservationUpdate,
  reservationMatchesIcalSyncUpdate,
} from "@/services/airbnb/ical-guest-name-sync";

describe("reservationMatchesIcalSyncUpdate", () => {
  const payload = {
    guestName: "Huésped Airbnb",
    guestFirstName: "Huésped",
    guestLastName: "Airbnb",
    checkIn: new Date("2026-06-27T00:00:00.000Z"),
    checkOut: new Date("2026-06-30T00:00:00.000Z"),
    status: ReservationStatus.CONFIRMED,
    platform: BookingPlatform.AIRBNB,
  };

  const existing = {
    ...payload,
    guestRegistrationCompletedAt: null,
  };

  it("returns true when sync update would not change stored fields", () => {
    const update = buildIcalSyncReservationUpdate(payload, existing);
    assert.equal(reservationMatchesIcalSyncUpdate(existing, update), true);
  });

  it("returns false when check-in changes", () => {
    const update = buildIcalSyncReservationUpdate(
      { ...payload, checkIn: new Date("2026-06-28T00:00:00.000Z") },
      existing,
    );
    assert.equal(reservationMatchesIcalSyncUpdate(existing, update), false);
  });

  it("returns false when enriched guest name would be applied to placeholder", () => {
    const update = buildIcalSyncReservationUpdate(
      { ...payload, guestName: "Diego Fernando Carrillo García", guestFirstName: "Diego", guestLastName: "Fernando Carrillo García" },
      existing,
    );
    assert.equal(reservationMatchesIcalSyncUpdate(existing, update), false);
  });

  it("returns true when enriched guest name is preserved (no guest fields in update)", () => {
    const enriched = {
      ...existing,
      guestName: "Diego Fernando Carrillo García",
      guestFirstName: "Diego",
      guestLastName: "Fernando Carrillo García",
    };
    const update = buildIcalSyncReservationUpdate(payload, enriched);
    assert.equal(reservationMatchesIcalSyncUpdate(enriched, update), true);
  });
});
