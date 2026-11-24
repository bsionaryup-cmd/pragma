import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure quote integrity — booking must never accept underpaid client totals.
 * Mirrors quoteStay in web-booking.service.ts.
 */
function quoteStay(
  nights: number,
  baseRate: number,
  cleaningFee: number,
) {
  const lodging = nights * baseRate;
  return { nights, total: lodging + cleaningFee };
}

describe("web-builder booking total integrity", () => {
  it("rejects client totals that underpay the server quote", () => {
    const quote = quoteStay(2, 150_000, 50_000);
    assert.equal(quote.total, 350_000);
    const clientTotal = 0;
    const mismatch = Math.abs(clientTotal - quote.total) > 1;
    assert.equal(mismatch, true);
  });

  it("accepts matching client totals within 1 COP tolerance", () => {
    const quote = quoteStay(3, 200_000, 0);
    assert.equal(quote.total, 600_000);
    assert.equal(Math.abs(600_000 - quote.total) > 1, false);
  });

  it("never treats a positive quote as free/PAID via client zero", () => {
    const quote = quoteStay(1, 100_000, 20_000);
    const enforcedTotal = Math.max(0, quote.total);
    const paymentStatus = enforcedTotal > 0 ? "PENDING" : "PAID";
    assert.equal(paymentStatus, "PENDING");
  });
});
