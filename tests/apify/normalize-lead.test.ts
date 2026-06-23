import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGoogleMapsItem } from "@/lib/apify/normalizeLead";
import { buildLeadDedupKey } from "@/lib/apify/lead-dedup";

describe("apify normalizeLead", () => {
  it("maps google maps items to normalized leads", () => {
    const lead = normalizeGoogleMapsItem({
      title: "Urban Stays",
      phone: "+57 300 000 0000",
      website: "https://urban.example",
      totalScore: 4.6,
      reviewsCount: 12,
      categoryName: "Apart hotel",
    });

    assert.ok(lead);
    assert.equal(lead.businessName, "Urban Stays");
    assert.equal(lead.source, "GOOGLE_MAPS");
    assert.equal(lead.reviews, 12);
    assert.equal(lead.website, "https://urban.example");
  });

  it("does not treat Google Maps listing URLs as business websites", () => {
    const lead = normalizeGoogleMapsItem({
      title: "Vacation Loft",
      url: "https://www.google.com/maps/search/?api=1&query=Vacation%20Loft",
      address: "Laureles, Medellín",
      categoryName: "Departamento",
    });

    assert.ok(lead);
    assert.equal(lead.website, null);
    assert.equal(lead.address, "Laureles, Medellín");
  });

  it("builds stable dedup keys", () => {
    const keyA = buildLeadDedupKey({
      businessName: "Urban Stays",
      phone: "+57 300 000 0000",
      website: "https://urban.example/",
    });
    const keyB = buildLeadDedupKey({
      businessName: "urban stays",
      phone: "573000000000",
      website: "http://urban.example",
    });

    assert.equal(keyA, keyB);
  });
});
