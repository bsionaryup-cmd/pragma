import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveReservationRevenueAmount } from "@/lib/finance/reservation-revenue-amount";

describe("resolveReservationRevenueAmount", () => {
  it("prefers host payout from email over stale stored totalAmount", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 247421,
      enrichedFields: { hostPayoutAmount: 1023779.89 },
    });
    assert.equal(amount, 1023779.89);
  });

  it("uses stored totalAmount when no host payout in enrichment", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 250000,
      enrichedFields: { guestTotalPaid: 999 },
    });
    assert.equal(amount, 250000);
  });

  it("reads host payout from payload signals when enrichedFields is null", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 0,
      payloadSignals: {
        hostPayoutAmount: 514011.14,
        grossAmount: 157565.25,
        netPayout: 0,
      },
    });
    assert.equal(amount, 514011.14);
  });

  it("extracts host payout from Airbnb email blob (Ganas)", () => {
    const amount = resolveReservationRevenueAmount({
      totalAmount: 0,
      emailMatchBlob:
        "Cobro del anfitrión\nPrecio de la habitación por 4 noches\n$630.261,00\nGanas\n$514.011,14",
    });
    assert.equal(amount, 514011.14);
  });
});
