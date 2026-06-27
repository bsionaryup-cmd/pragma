import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PropertyPriceLabsSyncStatus } from "@prisma/client";
import {
  isRevenuePropertyAnomaly,
  propertyMatchesSearch,
} from "@/features/revenue/lib/revenue-property-anomaly";
import { buildPropertyInsights } from "@/integrations/pricelabs/insights";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";

type PropertyRow = PriceLabsOverviewDto["properties"][number];

function sampleProperty(overrides: Partial<PropertyRow>): PropertyRow {
  return {
    id: "p1",
    name: "Loft Test",
    unitNumber: "801",
    city: "Medellín",
    baseRate: "500000",
    syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
    listingId: "listing-1",
    recommendedRate: "520000",
    priceDelta: "0",
    weekendUpliftPct: null,
    minRate: "400000",
    maxRate: "800000",
    listingBase: "500000",
    revenue: null,
    occupancy: null,
    lastSyncedAt: null,
    lastError: null,
    insights: buildPropertyInsights(null),
    ...overrides,
  };
}

describe("isRevenuePropertyAnomaly", () => {
  it("treats healthy synced properties as non-anomalies", () => {
    assert.equal(
      isRevenuePropertyAnomaly(
        sampleProperty({ priceDelta: "0", syncStatus: PropertyPriceLabsSyncStatus.SYNCED }),
      ),
      false,
    );
  });

  it("flags unmapped or errored properties", () => {
    assert.equal(isRevenuePropertyAnomaly(sampleProperty({ listingId: null })), true);
    assert.equal(
      isRevenuePropertyAnomaly(sampleProperty({ lastError: "Sin listing coincidente" })),
      true,
    );
  });
});

describe("propertyMatchesSearch", () => {
  it("matches unit number and name", () => {
    const property = sampleProperty({ unitNumber: "803", name: "Loft premium" });
    assert.equal(propertyMatchesSearch(property, "803"), true);
    assert.equal(propertyMatchesSearch(property, "premium"), true);
    assert.equal(propertyMatchesSearch(property, "999"), false);
  });
});

describe("pricing inventory visibility", () => {
  it("shows all properties when anomalies filter is off", () => {
    const properties = [
      sampleProperty({ id: "a", unitNumber: "801", priceDelta: "5" }),
      sampleProperty({ id: "b", unitNumber: "802", priceDelta: "-3" }),
      sampleProperty({ id: "c", unitNumber: "803", priceDelta: "0" }),
      sampleProperty({ id: "d", unitNumber: "804", priceDelta: "0.5" }),
    ];

    const anomaliesOnly = false;
    const visible = anomaliesOnly
      ? properties.filter(isRevenuePropertyAnomaly)
      : properties;

    assert.equal(visible.length, 4);
  });

  it("hides healthy synced properties when anomalies filter is on", () => {
    const properties = [
      sampleProperty({ id: "a", unitNumber: "801", priceDelta: "5" }),
      sampleProperty({ id: "b", unitNumber: "802", priceDelta: "-3" }),
      sampleProperty({ id: "c", unitNumber: "803", priceDelta: "0" }),
      sampleProperty({ id: "d", unitNumber: "804", priceDelta: "0.5" }),
    ];

    const visible = properties.filter(isRevenuePropertyAnomaly);
    assert.equal(visible.length, 2);
  });
});
