import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { computeChannelRevenueSummary } from "@/lib/finance/channel-revenue-summary";

describe("computeChannelRevenueSummary", () => {
  it("discrimina Airbnb, directos y total con otros ingresos", () => {
    const summary = computeChannelRevenueSummary({
      reservationRows: [
        { platform: BookingPlatform.AIRBNB, amount: 300_000 },
        { platform: BookingPlatform.AIRBNB, amount: 200_000 },
        { platform: BookingPlatform.DIRECT, amount: 150_000 },
      ],
      manualIncomeTotal: 50_000,
    });

    assert.equal(summary.airbnbRevenue, 500_000);
    assert.equal(summary.airbnbReservations, 2);
    assert.equal(summary.directRevenue, 150_000);
    assert.equal(summary.directReservations, 1);
    assert.equal(summary.manualRevenue, 50_000);
    assert.equal(summary.totalRevenue, 700_000);
    assert.equal(summary.totalReservations, 3);
  });
});
