import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGuestPaymentReference,
  isBillingSubscriptionReference,
  isGuestPaymentReference,
  parseGuestPaymentReference,
} from "../../src/lib/payments/guest-payment-reference";

describe("guest payment reference", () => {
  it("builds and parses guest reference", () => {
    const ref = buildGuestPaymentReference("link_abc");
    assert.equal(ref, "guest-link_abc");
    assert.equal(parseGuestPaymentReference(ref), "link_abc");
    assert.equal(isGuestPaymentReference(ref), true);
    assert.equal(isBillingSubscriptionReference(ref), false);
  });

  it("detects billing reference", () => {
    assert.equal(isBillingSubscriptionReference("pragma-inv_1"), true);
    assert.equal(isGuestPaymentReference("pragma-inv_1"), false);
  });
});
