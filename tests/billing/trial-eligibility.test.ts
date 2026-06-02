import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTrialBillingMetadata } from "../../src/lib/billing/trial-eligibility-metadata";
import {
  normalizeTrialOwnerEmail,
  trialRetrialPolicyLabel,
} from "../../src/lib/billing/trial-retrial-policy";

describe("buildTrialBillingMetadata", () => {
  it("stores normalized owner email and start timestamp", () => {
    const meta = buildTrialBillingMetadata("  Admin@Test.COM ");
    assert.equal(meta.trialOwnerEmail, "admin@test.com");
    assert.ok(meta.trialStartedAt);
  });
});

describe("trialRetrialPolicyLabel", () => {
  it("maps owner policies to Spanish labels", () => {
    assert.equal(trialRetrialPolicyLabel("ALLOW"), "Nueva prueba permitida");
    assert.equal(trialRetrialPolicyLabel("BLOCK"), "Prueba bloqueada");
    assert.equal(trialRetrialPolicyLabel("DEFAULT"), "Regla estándar");
  });
});

describe("normalizeTrialOwnerEmail", () => {
  it("normalizes email for trial tracking", () => {
    assert.equal(normalizeTrialOwnerEmail("  User@Test.COM "), "user@test.com");
    assert.equal(normalizeTrialOwnerEmail(null), null);
  });
});
