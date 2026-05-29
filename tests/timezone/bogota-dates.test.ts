import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCalendarDaysToKey,
  dateKeyToPrismaDate,
  todayDateKeyInTimezone,
} from "../../src/lib/dates";
import { startOfDay } from "../../src/lib/helpers/date";
import { getZonedParts } from "../../src/lib/timezone";

describe("todayDateKeyInTimezone (America/Bogota)", () => {
  it("uses Colombia calendar day when UTC is already the next day", () => {
    // 28 may 2026 23:30 COT = 29 may 2026 04:30 UTC
    const reference = new Date("2026-05-29T04:30:00.000Z");
    assert.equal(todayDateKeyInTimezone(reference), "2026-05-28");
  });

  it("advances at midnight Colombia (05:00 UTC)", () => {
    const reference = new Date("2026-05-29T05:00:00.000Z");
    assert.equal(todayDateKeyInTimezone(reference), "2026-05-29");
  });

  it("adds calendar days in Colombia without local drift", () => {
    const reference = new Date("2026-05-29T04:30:00.000Z");
    const tomorrow = addCalendarDaysToKey(todayDateKeyInTimezone(reference), 1);
    assert.equal(tomorrow, "2026-05-29");
  });
});

describe("startOfDay", () => {
  it("normalizes stay dates without local timezone drift", () => {
    const stay = dateKeyToPrismaDate("2026-06-02");
    assert.equal(startOfDay(stay).toISOString(), "2026-06-02T00:00:00.000Z");
  });
});

describe("getZonedParts", () => {
  it("returns Bogota wall clock for a known instant", () => {
    const parts = getZonedParts(new Date("2026-05-29T04:30:00.000Z"));
    assert.equal(parts.year, 2026);
    assert.equal(parts.month, 5);
    assert.equal(parts.day, 28);
    assert.equal(parts.hour, 23);
    assert.equal(parts.minute, 30);
  });
});
