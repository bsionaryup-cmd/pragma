import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BillingSubscriptionStatus } from "@prisma/client";
import {
  parseValidUntilDateInput,
  resolveTenantAccountState,
  toBogotaDateInputValue,
} from "../../src/lib/billing/tenant-account-state";

const NOW = new Date("2026-10-05T15:00:00.000Z");
const FUTURE = "2026-11-05T15:00:00.000Z";
const PAST = "2026-09-05T15:00:00.000Z";

function billing(
  overrides: Partial<NonNullable<Parameters<typeof resolveTenantAccountState>[0]["billing"]>>,
) {
  return {
    status: BillingSubscriptionStatus.ACTIVE,
    trialEndsAt: null,
    currentPeriodEnd: FUTURE,
    gracePeriodEndsAt: null,
    billingLockedAt: null,
    ...overrides,
  };
}

describe("resolveTenantAccountState", () => {
  it("active subscription with future period end is accessible", () => {
    const state = resolveTenantAccountState({
      organizationStatus: "ACTIVE",
      billing: billing({}),
      now: NOW,
    });
    assert.equal(state.code, "ACTIVE");
    assert.equal(state.accessBlocked, false);
    assert.equal(state.validityKind, "subscription");
    assert.equal(state.validUntil, FUTURE);
  });

  it("owner suspension blocks access even with valid subscription", () => {
    const state = resolveTenantAccountState({
      organizationStatus: "SUSPENDED",
      billing: billing({}),
      now: NOW,
    });
    assert.equal(state.code, "SUSPENDED");
    assert.equal(state.accessBlocked, true);
    assert.equal(state.billingLocked, false);
  });

  it("trial in progress uses trial end as validity", () => {
    const state = resolveTenantAccountState({
      organizationStatus: "ACTIVE",
      billing: billing({
        status: BillingSubscriptionStatus.TRIAL,
        trialEndsAt: FUTURE,
        currentPeriodEnd: null,
      }),
      now: NOW,
    });
    assert.equal(state.code, "TRIAL");
    assert.equal(state.validityKind, "trial");
    assert.equal(state.validUntil, FUTURE);
    assert.equal(state.accessBlocked, false);
  });

  it("expired trial is billing-locked", () => {
    const state = resolveTenantAccountState({
      organizationStatus: "ACTIVE",
      billing: billing({
        status: BillingSubscriptionStatus.TRIAL,
        trialEndsAt: PAST,
        currentPeriodEnd: null,
      }),
      now: NOW,
    });
    assert.equal(state.code, "LOCKED");
    assert.equal(state.billingLocked, true);
    assert.equal(state.validityKind, "trial");
  });

  it("past due within grace is still accessible and exposes lock date", () => {
    const state = resolveTenantAccountState({
      organizationStatus: "ACTIVE",
      billing: billing({
        status: BillingSubscriptionStatus.PAST_DUE,
        currentPeriodEnd: PAST,
        gracePeriodEndsAt: "2099-01-01T00:00:00.000Z",
      }),
      now: NOW,
    });
    assert.equal(state.code, "PAST_DUE");
    assert.equal(state.accessBlocked, false);
    assert.equal(state.gracePeriodEndsAt, "2099-01-01T00:00:00.000Z");
  });

  it("locked for non-payment is reported as subscription lock", () => {
    const state = resolveTenantAccountState({
      organizationStatus: "ACTIVE",
      billing: billing({
        status: BillingSubscriptionStatus.LOCKED,
        currentPeriodEnd: PAST,
        billingLockedAt: PAST,
      }),
      now: NOW,
    });
    assert.equal(state.code, "LOCKED");
    assert.equal(state.label, "Bloqueado por falta de pago");
    assert.equal(state.validityKind, "subscription");
  });

  it("canceled subscription is blocked", () => {
    const state = resolveTenantAccountState({
      organizationStatus: "ACTIVE",
      billing: billing({
        status: BillingSubscriptionStatus.CANCELED,
        billingLockedAt: PAST,
      }),
      now: NOW,
    });
    assert.equal(state.code, "CANCELED");
    assert.equal(state.accessBlocked, true);
  });

  it("active with expired period awaiting cron is a warning, not blocked", () => {
    const state = resolveTenantAccountState({
      organizationStatus: "ACTIVE",
      billing: billing({ currentPeriodEnd: PAST }),
      now: NOW,
    });
    assert.equal(state.code, "ACTIVE_EXPIRED");
    assert.equal(state.accessBlocked, false);
  });
});

describe("valid-until date input", () => {
  it("parses YYYY-MM-DD as end of day in Bogotá", () => {
    const date = parseValidUntilDateInput("2026-10-31");
    assert.ok(date);
    assert.equal(date.toISOString(), "2026-11-01T04:59:59.999Z");
    assert.equal(toBogotaDateInputValue(date), "2026-10-31");
  });

  it("rejects invalid input", () => {
    assert.equal(parseValidUntilDateInput("2026-02-30"), null);
    assert.equal(parseValidUntilDateInput("31/10/2026"), null);
    assert.equal(parseValidUntilDateInput(undefined), null);
  });

  it("formats ISO to Bogotá date input value", () => {
    assert.equal(toBogotaDateInputValue("2026-10-06T03:00:00.000Z"), "2026-10-05");
    assert.equal(toBogotaDateInputValue(null), "");
  });
});
