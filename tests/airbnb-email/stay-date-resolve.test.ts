import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkInWithinSlack,
  inferStayDatesFromPropertyCandidates,
  stayDatesOverlap,
} from "../../src/modules/airbnb-email/matching/stay-date-resolve";

describe("stay-date-resolve", () => {
  const candidate = {
    checkIn: new Date("2026-06-19T15:00:00.000Z"),
    checkOut: new Date("2026-06-23T10:00:00.000Z"),
  };

  it("acepta check-in dentro de slack ±5 días", () => {
    const emailCheckIn = new Date("2026-06-19T12:00:00.000Z");
    assert.equal(checkInWithinSlack(candidate.checkIn, emailCheckIn), true);
    assert.equal(
      stayDatesOverlap(candidate, emailCheckIn, null),
      true,
    );
  });

  it("infiere check-out desde única reserva iCal cuando falta en email", () => {
    const emailCheckIn = new Date("2026-06-19T12:00:00.000Z");
    const resolved = inferStayDatesFromPropertyCandidates(
      emailCheckIn,
      null,
      [candidate],
    );
    assert.equal(resolved.inferredCheckOutFromIcal, true);
    assert.equal(
      resolved.checkOut?.toISOString(),
      candidate.checkOut.toISOString(),
    );
  });

  it("overlap con check-in y check-out del email", () => {
    const emailCheckIn = new Date("2026-06-19T12:00:00.000Z");
    const emailCheckOut = new Date("2026-06-23T12:00:00.000Z");
    assert.equal(
      stayDatesOverlap(candidate, emailCheckIn, emailCheckOut),
      true,
    );
  });
});
