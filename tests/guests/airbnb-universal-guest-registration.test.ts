import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAirbnbUniversalAccessRateLimitKey,
  checkAirbnbUniversalAccessRateLimit,
  checkAirbnbUniversalAccessRateLimits,
  normalizeAirbnbReservationCode,
} from "../../src/services/guests/airbnb-universal-guest-registration.service";

describe("Airbnb universal guest-registration access", () => {
  it("normalizes reservation codes without changing their internal format", () => {
    assert.equal(normalizeAirbnbReservationCode(" hm-ab12cd3 "), "HM-AB12CD3");
  });

  it("hashes client addresses before storing a rate-limit key", () => {
    const raw = "203.0.113.8";
    const key = buildAirbnbUniversalAccessRateLimitKey(raw);

    assert.notEqual(key, raw);
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(key, buildAirbnbUniversalAccessRateLimitKey(raw));
  });

  it("limits a client to five attempts per window", () => {
    const key = buildAirbnbUniversalAccessRateLimitKey(
      `test-${Date.now()}-${Math.random()}`,
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal(checkAirbnbUniversalAccessRateLimit(key), true);
    }
    assert.equal(checkAirbnbUniversalAccessRateLimit(key), false);
  });

  it("tracks IP and reservation-code buckets independently", () => {
    const nonce = `${Date.now()}-${Math.random()}`;
    const ipKey = `ip:${buildAirbnbUniversalAccessRateLimitKey(`ip-${nonce}`)}`;
    const codeKey = `code:${buildAirbnbUniversalAccessRateLimitKey(
      `code-${nonce}`,
    )}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal(checkAirbnbUniversalAccessRateLimit(ipKey), true);
    }
    assert.equal(checkAirbnbUniversalAccessRateLimit(ipKey), false);
    assert.equal(checkAirbnbUniversalAccessRateLimit(codeKey), true);
  });

  it("does not consume code buckets after the IP is blocked", () => {
    const nonce = `${Date.now()}-${Math.random()}`;
    const blockedIpKey = `ip:${buildAirbnbUniversalAccessRateLimitKey(
      `blocked-${nonce}`,
    )}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const warmupCodeKey = `code:${buildAirbnbUniversalAccessRateLimitKey(
        `warmup-${attempt}-${nonce}`,
      )}`;
      assert.equal(
        checkAirbnbUniversalAccessRateLimits(blockedIpKey, warmupCodeKey),
        true,
      );
    }

    const targetCodeKey = `code:${buildAirbnbUniversalAccessRateLimitKey(
      `target-${nonce}`,
    )}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal(
        checkAirbnbUniversalAccessRateLimits(blockedIpKey, targetCodeKey),
        false,
      );
    }

    const freshIpKey = `ip:${buildAirbnbUniversalAccessRateLimitKey(
      `fresh-${nonce}`,
    )}`;
    assert.equal(
      checkAirbnbUniversalAccessRateLimits(freshIpKey, targetCodeKey),
      true,
    );
  });
});
