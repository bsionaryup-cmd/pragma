import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBillingAccountMetadata } from "../../src/modules/billing/domain/subscription-property-count";

describe("sales billing metadata", () => {
  it("parses quoted monthly amount from billing metadata", () => {
    const meta = parseBillingAccountMetadata({
      propertySlots: 5,
      salesQuoteId: "quote_1",
      quotedMonthlyAmountCop: 250_000,
      quotedPlan: "PRO",
    });
    assert.equal(meta.quotedMonthlyAmountCop, 250_000);
    assert.equal(meta.quotedPlan, "PRO");
    assert.equal(meta.salesQuoteId, "quote_1");
  });

  it("ignores invalid metadata safely", () => {
    const meta = parseBillingAccountMetadata(null);
    assert.equal(meta.quotedMonthlyAmountCop, undefined);
  });
});
