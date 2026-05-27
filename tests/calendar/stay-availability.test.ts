import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampSelectableCheckOut,
  findStayRangeConflict,
  isNightOccupiedByStay,
  isStayRangeAvailable,
  stayRangesOverlap,
} from "../../src/features/calendar/lib/stay-availability";

const stay = {
  checkIn: "2026-06-10",
  checkOut: "2026-06-15",
  status: "CONFIRMED",
  guestName: "Ana",
};

describe("stay-availability", () => {
  it("treats checkout day as free", () => {
    assert.equal(isNightOccupiedByStay("2026-06-09", stay), false);
    assert.equal(isNightOccupiedByStay("2026-06-10", stay), true);
    assert.equal(isNightOccupiedByStay("2026-06-14", stay), true);
    assert.equal(isNightOccupiedByStay("2026-06-15", stay), false);
  });

  it("detects range overlap with PMS semantics", () => {
    assert.equal(
      stayRangesOverlap("2026-06-12", "2026-06-18", stay.checkIn, stay.checkOut),
      true,
    );
    assert.equal(
      stayRangesOverlap("2026-06-15", "2026-06-20", stay.checkIn, stay.checkOut),
      false,
    );
  });

  it("rejects ranges that cross an existing stay", () => {
    assert.equal(isStayRangeAvailable("2026-06-12", "2026-06-18", [stay]), false);
    assert.deepEqual(
      findStayRangeConflict("2026-06-12", "2026-06-18", [stay]),
      stay,
    );
  });

  it("clamps checkout before the first occupied night", () => {
    assert.equal(
      clampSelectableCheckOut("2026-06-08", "2026-06-20", [stay]),
      "2026-06-10",
    );
  });
});
