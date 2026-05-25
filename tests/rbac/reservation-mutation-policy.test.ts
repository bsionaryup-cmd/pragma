import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertReservationDateMutationAllowed,
  isHistoricalOrClosedReservation,
  ReservationMutationPolicyError,
} from "../../src/lib/reservations/reservation-mutation-policy";

describe("reservation mutation policy", () => {
  it("blocks create with check-in in the past", () => {
    assert.throws(
      () =>
        assertReservationDateMutationAllowed({
          operation: "create",
          checkIn: "2020-01-01",
          checkOut: "2020-01-05",
          allowHistoricalOverride: false,
        }),
      ReservationMutationPolicyError,
    );
  });

  it("allows create from today onward", () => {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, "0");
    const d = String(today.getUTCDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;
    assert.doesNotThrow(() =>
      assertReservationDateMutationAllowed({
        operation: "create",
        checkIn: todayKey,
        checkOut: `${y}-${m}-${String(Number(d) + 2).padStart(2, "0")}`,
        allowHistoricalOverride: false,
      }),
    );
  });

  it("detects historical closed reservations", () => {
    assert.equal(
      isHistoricalOrClosedReservation("2020-01-01", "CHECKED_OUT"),
      true,
    );
    assert.equal(
      isHistoricalOrClosedReservation("2099-12-31", "CANCELLED"),
      true,
    );
  });

  it("blocks update on historical reservation without override", () => {
    assert.throws(
      () =>
        assertReservationDateMutationAllowed({
          operation: "update",
          checkIn: "2020-01-01",
          checkOut: "2020-01-05",
          existing: {
            checkIn: "2020-01-01",
            checkOut: "2020-01-05",
            status: "CHECKED_OUT",
          },
          allowHistoricalOverride: false,
        }),
      ReservationMutationPolicyError,
    );
  });

  it("allows override path", () => {
    assert.doesNotThrow(() =>
      assertReservationDateMutationAllowed({
        operation: "update",
        checkIn: "2020-01-01",
        checkOut: "2020-01-05",
        existing: {
          checkIn: "2020-01-01",
          checkOut: "2020-01-05",
          status: "CHECKED_OUT",
        },
        allowHistoricalOverride: true,
      }),
    );
  });
});
