import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateSalesQuote } from "../../src/modules/sales/domain/quote-calculator";

describe("sales quote calculator", () => {
  it("uses real plan catalog pricing", () => {
    const result = calculateSalesQuote({
      plan: "STARTER",
      propertyCount: 2,
    });
    assert.equal(result.listMonthlyCop, 79_999 * 2);
    assert.equal(result.finalMonthlyCop, result.listMonthlyCop);
  });

  it("applies percent discount without negative final", () => {
    const result = calculateSalesQuote({
      plan: "PRO",
      propertyCount: 3,
      discountPercent: 10,
    });
    assert.ok(result.finalMonthlyCop > 0);
    assert.ok(result.savingsCop > 0);
    assert.equal(result.finalMonthlyCop, result.listMonthlyCop - result.savingsCop);
  });

  it("caps discount at list price", () => {
    const result = calculateSalesQuote({
      plan: "STARTER",
      propertyCount: 1,
      discountPercent: 80,
      discountAmountCop: 999_999,
    });
    assert.equal(result.finalMonthlyCop, 0);
  });
});
