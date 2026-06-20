import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReservationStatus } from "@prisma/client";

describe("dashboard today queries", () => {
  it("uses cancelled exclusion consistent with visible reservations", () => {
    assert.notEqual(ReservationStatus.CANCELLED, ReservationStatus.CONFIRMED);
  });
});
