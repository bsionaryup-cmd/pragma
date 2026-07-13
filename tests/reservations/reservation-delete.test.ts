import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import {
  DIRECT_RESERVATION_DELETE_CONFIRM_MESSAGE,
  isDirectReservationDeletable,
  isOtaImportedReservation,
  OTA_RESERVATION_DELETE_MESSAGE,
} from "@/lib/reservations/reservation-ota";

describe("reservation delete eligibility", () => {
  it("allows DIRECT reservations without external UID", () => {
    assert.equal(
      isDirectReservationDeletable({
        platform: BookingPlatform.DIRECT,
        icalUid: null,
      }),
      true,
    );
    assert.equal(
      isOtaImportedReservation({
        platform: BookingPlatform.DIRECT,
        icalUid: null,
      }),
      false,
    );
  });

  it("blocks DIRECT reservations linked to an iCal UID", () => {
    assert.equal(
      isDirectReservationDeletable({
        platform: BookingPlatform.DIRECT,
        icalUid: "airbnb:123",
      }),
      false,
    );
  });

  it("blocks Airbnb reservations", () => {
    assert.equal(
      isDirectReservationDeletable({
        platform: BookingPlatform.AIRBNB,
        icalUid: "airbnb:123",
      }),
      false,
    );
    assert.equal(
      isDirectReservationDeletable({
        platform: BookingPlatform.AIRBNB,
        icalUid: null,
      }),
      false,
    );
  });

  it("blocks Booking.com reservations", () => {
    assert.equal(
      isDirectReservationDeletable({
        platform: BookingPlatform.BOOKING,
        icalUid: null,
      }),
      false,
    );
  });

  it("exposes user-facing messages", () => {
    assert.match(OTA_RESERVATION_DELETE_MESSAGE, /Airbnb/i);
    assert.match(OTA_RESERVATION_DELETE_MESSAGE, /Booking/i);
    assert.match(DIRECT_RESERVATION_DELETE_CONFIRM_MESSAGE, /permanentemente/i);
  });
});
