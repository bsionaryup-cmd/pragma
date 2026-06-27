import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform, ReservationStatus } from "@prisma/client";
import { resolveCalendarBarStatus } from "@/features/calendar/lib/calendar-bar-status";
import {
  getReservationBarShellClasses,
  getReservationStickyNameClasses,
  getReservationVisualState,
} from "@/features/calendar/lib/reservation-style";
import type { CalendarReservationDto } from "@/features/calendar/types/calendar.types";

function sampleReservation(
  overrides: Partial<CalendarReservationDto>,
): CalendarReservationDto {
  return {
    id: "res-1",
    propertyId: "prop-1",
    guestName: "Guest",
    checkIn: "2026-06-01",
    checkOut: "2026-06-05",
    status: ReservationStatus.CONFIRMED,
    totalAmount: "100000",
    currency: "COP",
    platform: BookingPlatform.DIRECT,
    ...overrides,
  };
}

describe("resolveCalendarBarStatus", () => {
  it("presents past direct stays as CHECKED_OUT without changing platform rules", () => {
    const status = resolveCalendarBarStatus(
      ReservationStatus.CONFIRMED,
      new Date("2026-01-01T12:00:00Z"),
      new Date("2026-01-05T12:00:00Z"),
    );
    assert.equal(status, ReservationStatus.CHECKED_OUT);
  });
});

describe("calendar reservation visual state", () => {
  it("uses checked_out styling for every platform when status is CHECKED_OUT", () => {
    const platforms: BookingPlatform[] = [
      BookingPlatform.AIRBNB,
      BookingPlatform.DIRECT,
      BookingPlatform.BOOKING,
    ];

    for (const platform of platforms) {
      const reservation = sampleReservation({
        platform,
        status: ReservationStatus.CHECKED_OUT,
      });
      assert.equal(getReservationVisualState(reservation), "checked_out");
      assert.equal(
        getReservationBarShellClasses("checked_out"),
        getReservationBarShellClasses(getReservationVisualState(reservation)),
      );
      assert.equal(
        getReservationStickyNameClasses("checked_out"),
        getReservationStickyNameClasses(getReservationVisualState(reservation)),
      );
    }
  });

  it("does not vary active styling by platform", () => {
    const airbnb = sampleReservation({ platform: BookingPlatform.AIRBNB });
    const direct = sampleReservation({ platform: BookingPlatform.DIRECT });

    assert.equal(
      getReservationVisualState(airbnb),
      getReservationVisualState(direct),
    );
    assert.equal(
      getReservationBarShellClasses(getReservationVisualState(airbnb)),
      getReservationBarShellClasses(getReservationVisualState(direct)),
    );
  });
});

describe("property capacity label", () => {
  it("formats maxGuests from property configuration", async () => {
    const { formatPropertyCapacityLabel } = await import(
      "@/features/calendar/lib/property-capacity"
    );
    assert.equal(formatPropertyCapacityLabel(4), "× 4");
    assert.equal(formatPropertyCapacityLabel(0), "");
    assert.equal(formatPropertyCapacityLabel(undefined), "");
  });
});
