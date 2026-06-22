import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEEDED_BILLING_ACCOUNT_WHERE,
  ownerCommercialOrganizationWhere,
  type OwnerCommercialScope,
} from "@/services/platform/owner-dashboard-scope";

describe("ownerCommercialOrganizationWhere", () => {
  it("excludes platform org names and seeded org ids from scope", () => {
    const scope: OwnerCommercialScope = {
      organizationWhere: {
        deletedAt: null,
        name: { notIn: ["PRAGMA Platform (Wompi)", "PRAGMA Platform (Epayco)"] },
        id: { notIn: ["cmqgdwu0d000070ty7dlni159"] },
      },
    };

    assert.deepEqual(ownerCommercialOrganizationWhere(scope), scope.organizationWhere);
  });

  it("uses billing.metadata.seeded === true as the seeded marker", () => {
    assert.deepEqual(SEEDED_BILLING_ACCOUNT_WHERE, {
      metadata: {
        path: ["seeded"],
        equals: true,
      },
    });
  });
});

describe("sumConfirmedReservationRevenue", () => {
  it("counts only reservations with check-in on or before today", async () => {
    const { sumConfirmedReservationRevenue } = await import(
      "@/lib/finance/confirmed-reservation-revenue"
    );
    const today = new Date(Date.UTC(2026, 5, 22));
    const pastCheckIn = new Date(Date.UTC(2026, 5, 10));
    const futureCheckIn = new Date(Date.UTC(2026, 5, 25));

    const total = sumConfirmedReservationRevenue(
      [
        {
          id: "past",
          totalAmount: 100000,
          platform: "AIRBNB",
          icalUid: null,
          reservationCode: null,
          checkIn: pastCheckIn,
          paymentStatus: "PAID",
        },
        {
          id: "future",
          totalAmount: 500000,
          platform: "AIRBNB",
          icalUid: null,
          reservationCode: null,
          checkIn: futureCheckIn,
          paymentStatus: "PAID",
        },
      ],
      new Map(),
      today,
    );

    assert.equal(total, 100000);
  });
});
