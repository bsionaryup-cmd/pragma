import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, clamp, round2, round4, startOfBogotaDay } from "../../src/domains/retail-intelligence/lib/math";

describe("retail-intelligence math", () => {
  it("clamps and rounds", () => {
    assert.equal(clamp(150, 0, 100), 100);
    assert.equal(round2(1.239), 1.24);
    assert.equal(round4(1.23456), 1.2346);
  });

  it("computes bogota day bucket", () => {
    const day = startOfBogotaDay(new Date("2026-07-13T18:00:00.000Z"));
    assert.equal(day.toISOString().startsWith("2026-07-13"), true);
    const next = addDays(day, 2);
    assert.equal(next.toISOString().startsWith("2026-07-15"), true);
  });
});
