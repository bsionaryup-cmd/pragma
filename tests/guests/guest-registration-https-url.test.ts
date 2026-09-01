import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ensureHttpsPublicOrigin,
  getAirbnbUniversalGuestRegistrationUrl,
  PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN,
} from "../../src/lib/app-url";

describe("ensureHttpsPublicOrigin", () => {
  it("upgrades http www.pragmapms.com to https canonical", () => {
    assert.equal(
      ensureHttpsPublicOrigin("http://www.pragmapms.com"),
      PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN,
    );
  });

  it("upgrades http apex pragmapms.com to https canonical", () => {
    assert.equal(
      ensureHttpsPublicOrigin("http://pragmapms.com"),
      PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN,
    );
  });

  it("preserves localhost http for local dev", () => {
    assert.equal(
      ensureHttpsPublicOrigin("http://localhost:3000"),
      "http://localhost:3000",
    );
  });
});

describe("getAirbnbUniversalGuestRegistrationUrl", () => {
  it("never emits cleartext production guest-registration link", () => {
    assert.equal(
      getAirbnbUniversalGuestRegistrationUrl("http://www.pragmapms.com"),
      "https://www.pragmapms.com/guest-registration",
    );
  });

  it("ignores http browser origin on production hosts", () => {
    assert.equal(
      getAirbnbUniversalGuestRegistrationUrl("http://pragmapms.com"),
      "https://www.pragmapms.com/guest-registration",
    );
  });

  it("allows localhost origin for local WhatsApp copy", () => {
    assert.equal(
      getAirbnbUniversalGuestRegistrationUrl("http://localhost:3000"),
      "http://localhost:3000/guest-registration",
    );
  });
});
