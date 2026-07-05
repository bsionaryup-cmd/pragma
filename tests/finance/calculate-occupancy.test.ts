import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateOccupancy } from "@/lib/finance/calculate-occupancy";

describe("calculateOccupancy", () => {
  it("returns 0 when no available nights", () => {
    assert.equal(calculateOccupancy({ occupiedNights: 5, availableNights: 0 }), 0);
  });

  it("computes blocked-adjusted portfolio occupancy", () => {
    assert.equal(
      calculateOccupancy({ occupiedNights: 9, availableNights: 31 }),
      29,
    );
  });

  it("caps at 100%", () => {
    assert.equal(
      calculateOccupancy({ occupiedNights: 40, availableNights: 30 }),
      100,
    );
  });
});
