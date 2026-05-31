import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeReservationPaymentBalance } from "../../src/lib/payments/reservation-payment-balance-calc";

describe("reservation payment balance", () => {
  it("sums link and manual payments as paid amount", () => {
    const result = computeReservationPaymentBalance({
      totalAmount: 450_000,
      links: [
        { amount: 100_000, status: "PAID" },
        { amount: 50_000, status: "SENT" },
      ],
      manualPayments: [{ amount: 150_000 }],
    });

    assert.equal(result.linkPaidAmount, 100_000);
    assert.equal(result.manualPaidAmount, 150_000);
    assert.equal(result.paidAmount, 250_000);
    assert.equal(result.pendingAmount, 50_000);
    assert.equal(result.remainingBalance, 150_000);
  });

  it("returns zero remaining when fully covered", () => {
    const result = computeReservationPaymentBalance({
      totalAmount: 300_000,
      links: [{ amount: 200_000, status: "PAID" }],
      manualPayments: [{ amount: 100_000 }],
    });

    assert.equal(result.paidAmount, 300_000);
    assert.equal(result.remainingBalance, 0);
  });

  it("treats pending links as reserved balance", () => {
    const result = computeReservationPaymentBalance({
      totalAmount: 500_000,
      links: [{ amount: 500_000, status: "PENDING" }],
      manualPayments: [],
    });

    assert.equal(result.paidAmount, 0);
    assert.equal(result.pendingAmount, 500_000);
    assert.equal(result.remainingBalance, 0);
  });
});
