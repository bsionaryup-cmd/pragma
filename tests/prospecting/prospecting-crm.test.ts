import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROSPECTING_LEAD_STATUSES } from "@/services/prospecting/prospecting-crm.types";

describe("prospecting crm types", () => {
  it("includes full pipeline statuses with NEW default first", () => {
    assert.equal(PROSPECTING_LEAD_STATUSES[0], "NEW");
    assert.ok(PROSPECTING_LEAD_STATUSES.includes("DEMO"));
    assert.ok(PROSPECTING_LEAD_STATUSES.includes("CUSTOMER"));
    assert.ok(PROSPECTING_LEAD_STATUSES.includes("ARCHIVED"));
    assert.equal(PROSPECTING_LEAD_STATUSES.length, 9);
  });
});
