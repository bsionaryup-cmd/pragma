import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeAirbnbQualificationScore,
  computeProspectingScore,
} from "@/lib/prospecting/prospecting-score";

describe("prospecting score", () => {
  it("prioritizes leads with phone and high fit", () => {
    const result = computeProspectingScore({
      phone: "+57 300 000 0000",
      website: "https://example.com",
      rating: 4.8,
      reviews: 40,
      listingsCount: null,
      category: "Property management",
      leadType: "PROPERTY_MANAGER",
      potentialPragmaFit: "HIGH",
      estimatedSophistication: "HIGH",
      status: "NEW",
    });

    assert.equal(result.priority, "HOT");
    assert.ok(result.score >= 68);
  });

  it("marks closed leads as cold", () => {
    const result = computeProspectingScore({
      phone: "+57 300 000 0000",
      website: null,
      rating: null,
      reviews: null,
      listingsCount: null,
      category: null,
      leadType: null,
      potentialPragmaFit: null,
      estimatedSophistication: null,
      status: "ARCHIVED",
    });

    assert.equal(result.score, 0);
    assert.equal(result.priority, "COLD");
  });

  it("scores airbnb portfolio signals", () => {
    const airbnb = computeAirbnbQualificationScore({
      listingsCount: 6,
      rating: 4.9,
      reviews: 80,
      category: "Superhost property manager",
    });
    assert.equal(airbnb, "HIGH");
  });
});
