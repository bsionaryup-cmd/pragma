import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProspectingRateLimitKey,
  checkProspectingSearchRateLimit,
} from "@/lib/apify/prospecting-rate-limit";

describe("prospecting rate limit", () => {
  it("scopes limits by organization and user", () => {
    const orgA = "org_a";
    const orgB = "org_b";
    const userA = "user_a";

    assert.ok(checkProspectingSearchRateLimit(orgA, userA));
    assert.ok(!checkProspectingSearchRateLimit(orgA, userA));
    assert.ok(checkProspectingSearchRateLimit(orgB, userA));
    assert.ok(checkProspectingSearchRateLimit(orgA, "user_b"));
  });

  it("builds stable keys", () => {
    assert.equal(
      buildProspectingRateLimitKey("org", "user"),
      "org:user",
    );
  });
});
