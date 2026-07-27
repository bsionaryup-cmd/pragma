import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStayPortalAccessRateLimitKey,
  checkStayPortalAccessRateLimit,
  checkStayPortalAccessRateLimits,
  normalizeStayReservationCode,
} from "../../src/lib/guest-registration/stay-portal-access";

describe("stay portal access helpers", () => {
  it("normalizes reservation codes", () => {
    assert.equal(normalizeStayReservationCode("  hm123abc  "), "HM123ABC");
  });

  it("rate-limits repeated keys", () => {
    const key = `test:${buildStayPortalAccessRateLimitKey(String(Date.now()))}`;
    for (let i = 0; i < 5; i++) {
      assert.equal(checkStayPortalAccessRateLimit(key), true);
    }
    assert.equal(checkStayPortalAccessRateLimit(key), false);
  });
});
