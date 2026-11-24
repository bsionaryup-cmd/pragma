import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { reservationOccupancyEditSchema } from "@/features/reservations/schemas/reservation.schema";
import { isGuestRegistrationPendingUpdate } from "@/lib/reservations/guest-registration-pending-update";
import { getGuestRegistrationMaxCapacity } from "@/lib/guest-registration/guest-registration-capacity";

describe("reservation occupancy manual edit", () => {
  it("schema accepts adults/children/infants", () => {
    const parsed = reservationOccupancyEditSchema.parse({
      adults: 4,
      children: 1,
      infants: 0,
      maxGuests: 6,
    });
    assert.equal(parsed.adults, 4);
    assert.equal(parsed.children, 1);
  });

  it("schema rejects zero adults", () => {
    assert.throws(() =>
      reservationOccupancyEditSchema.parse({
        adults: 0,
        children: 2,
        infants: 0,
      }),
    );
  });

  it("schema rejects over property capacity", () => {
    const result = reservationOccupancyEditSchema.safeParse({
      adults: 3,
      children: 2,
      infants: 1,
      maxGuests: 4,
    });
    assert.equal(result.success, false);
  });

  it("pendingUpdate when registered < capacity and GR not completed", () => {
    assert.equal(
      isGuestRegistrationPendingUpdate({
        guestRegistrationCompletedAt: null,
        registered: 2,
        capacity: 4,
      }),
      true,
    );
  });

  it("not pendingUpdate when GR completed", () => {
    assert.equal(
      isGuestRegistrationPendingUpdate({
        guestRegistrationCompletedAt: new Date().toISOString(),
        registered: 2,
        capacity: 4,
      }),
      false,
    );
  });

  it("expected registration capacity is adults+children+infants", () => {
    assert.equal(
      getGuestRegistrationMaxCapacity({
        platform: BookingPlatform.AIRBNB,
        adults: 3,
        children: 1,
        infants: 2,
      }),
      6,
    );
  });
});
