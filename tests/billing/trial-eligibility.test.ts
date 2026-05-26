import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTrialBillingMetadata } from "../../src/lib/billing/trial-eligibility-metadata";

describe("buildTrialBillingMetadata", () => {
  it("stores normalized owner email and start timestamp", () => {
    const meta = buildTrialBillingMetadata("  Admin@Test.COM ");
    assert.equal(meta.trialOwnerEmail, "admin@test.com");
    assert.ok(meta.trialStartedAt);
  });
});
