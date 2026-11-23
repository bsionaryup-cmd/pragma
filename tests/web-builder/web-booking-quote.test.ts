import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors quote logic in web-booking.service (pure unit). */
function quoteStay(
  nights: number,
  baseRate: number,
  cleaningFee: number,
  currency: string,
) {
  const lodging = nights * baseRate;
  return {
    nights,
    baseRate,
    cleaningFee,
    lodgingSubtotal: lodging,
    total: lodging + cleaningFee,
    currency,
  };
}

describe("web-builder booking quote", () => {
  it("quotes nights * baseRate + cleaningFee", () => {
    const q = quoteStay(3, 250_000, 80_000, "COP");
    assert.equal(q.nights, 3);
    assert.equal(q.lodgingSubtotal, 750_000);
    assert.equal(q.total, 830_000);
    assert.equal(q.currency, "COP");
  });

  it("handles zero base rate without inventing prices", () => {
    const q = quoteStay(2, 0, 50_000, "COP");
    assert.equal(q.total, 50_000);
  });
});
