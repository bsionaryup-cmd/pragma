import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConversationGuide } from "@/lib/prospecting/prospecting-conversation-guide";
import {
  buildLeadScoreReasons,
  getFollowUpUrgency,
  rankContactNext,
} from "@/lib/prospecting/prospecting-intelligence";

describe("prospecting intelligence", () => {
  it("detects overdue follow-ups", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    assert.equal(
      getFollowUpUrgency(yesterday.toISOString()),
      "OVERDUE",
    );
  });

  it("builds score reasons for hot PM leads", () => {
    const reasons = buildLeadScoreReasons({
      phone: "+57 300 000 0000",
      website: "https://pm.example",
      rating: 4.8,
      reviews: 30,
      listingsCount: null,
      category: "Property management",
      leadType: "PROPERTY_MANAGER",
      potentialPragmaFit: "HIGH",
      estimatedSophistication: "HIGH",
      airbnbScore: null,
      status: "NEW",
      priority: "HOT",
      outreachMessage: null,
      nextFollowUpDate: null,
    });

    assert.ok(reasons.some((r) => r.includes("Teléfono")));
    assert.ok(reasons.some((r) => r.includes("property manager") || r.includes("gestión")));
  });

  it("ranks overdue HOT leads highest in contact queue", () => {
    const overdue = rankContactNext({
      phone: "+57 300",
      website: null,
      rating: null,
      reviews: null,
      listingsCount: null,
      category: null,
      leadType: null,
      potentialPragmaFit: null,
      estimatedSophistication: null,
      airbnbScore: null,
      status: "FOLLOW_UP",
      priority: "HOT",
      outreachMessage: "hola",
      nextFollowUpDate: new Date(Date.now() - 86_400_000).toISOString(),
      prospectingScore: 70,
    });
    const fresh = rankContactNext({
      phone: "+57 300",
      website: null,
      rating: null,
      reviews: null,
      listingsCount: null,
      category: null,
      leadType: null,
      potentialPragmaFit: null,
      estimatedSophistication: null,
      airbnbScore: null,
      status: "NEW",
      priority: "WARM",
      outreachMessage: null,
      nextFollowUpDate: null,
      prospectingScore: 40,
    });
    assert.ok(overdue > fresh);
  });
});

describe("conversation guide", () => {
  it("provides fallback guidance without OpenAI", () => {
    const guide = buildConversationGuide({
      phone: "+57 300",
      website: null,
      rating: null,
      reviews: null,
      listingsCount: 5,
      category: "Airbnb property management",
      leadType: "PROPERTY_MANAGER",
      potentialPragmaFit: null,
      estimatedSophistication: null,
      airbnbScore: "HIGH",
      status: "NEW",
      priority: "HOT",
      outreachMessage: null,
      nextFollowUpDate: null,
    });

    assert.ok(guide.likelyPainPoints.length >= 3);
    assert.ok(guide.recommendedFirstQuestion.includes("?"));
    assert.ok(guide.recommendedFollowUp.length > 10);
  });
});
