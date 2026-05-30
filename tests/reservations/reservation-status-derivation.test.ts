import { ReservationStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateKeyToPrismaDate } from "@/lib/dates";
import { localColombiaDateTime } from "@/lib/stay-schedule";
import { deriveReservationStatusFromDates } from "@/services/reservations/reservation-status";

describe("deriveReservationStatusFromDates", () => {
  const checkIn = dateKeyToPrismaDate("2026-05-28");
  const checkOut = dateKeyToPrismaDate("2026-05-30");

  it("keeps CONFIRMED on check-in day before 3 PM", () => {
    const now = localColombiaDateTime("2026-05-28", 10, 0);
    assert.equal(
      deriveReservationStatusFromDates(checkIn, checkOut, { now }),
      ReservationStatus.CONFIRMED,
    );
  });

  it("marks CHECKED_IN after check-in hour on arrival day", () => {
    const now = localColombiaDateTime("2026-05-28", 16, 0);
    assert.equal(
      deriveReservationStatusFromDates(checkIn, checkOut, { now }),
      ReservationStatus.CHECKED_IN,
    );
  });

  it("keeps CHECKOUT_TODAY on checkout day before 1 PM", () => {
    const now = localColombiaDateTime("2026-05-30", 10, 0);
    assert.equal(
      deriveReservationStatusFromDates(checkIn, checkOut, { now }),
      ReservationStatus.CHECKOUT_TODAY,
    );
  });

  it("marks CHECKED_OUT after checkout hour on checkout day", () => {
    const now = localColombiaDateTime("2026-05-30", 14, 0);
    assert.equal(
      deriveReservationStatusFromDates(checkIn, checkOut, { now }),
      ReservationStatus.CHECKED_OUT,
    );
  });

  it("marks CHECKED_OUT after checkout day has passed", () => {
    const now = localColombiaDateTime("2026-05-31", 9, 0);
    assert.equal(
      deriveReservationStatusFromDates(checkIn, checkOut, { now }),
      ReservationStatus.CHECKED_OUT,
    );
  });
});
