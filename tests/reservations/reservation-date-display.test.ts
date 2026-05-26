import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateKeyToPrismaDate, prismaDateToKey, toReservationDateKey } from "../../src/lib/dates";
import { formatDate } from "../../src/lib/helpers/date";

describe("toReservationDateKey", () => {
  it("keeps Prisma @db.Date as calendar day in UTC", () => {
    const stored = dateKeyToPrismaDate("2025-06-02");
    assert.equal(toReservationDateKey(stored), "2025-06-02");
  });

  it("normalizes ISO strings without local timezone drift", () => {
    assert.equal(
      toReservationDateKey("2025-06-02T00:00:00.000Z"),
      "2025-06-02",
    );
  });
});

describe("formatDate for stays", () => {
  it("shows the same calendar day as prismaDateToKey", () => {
    const stored = dateKeyToPrismaDate("2025-06-02");
    const label = formatDate(stored);
    assert.match(label, /2/);
    assert.match(label, /jun/i);
    assert.doesNotMatch(label, /1/);
  });
});
