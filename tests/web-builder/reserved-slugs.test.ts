import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReservedPublicSlug,
  normalizeSiteSlug,
} from "@/lib/web-builder/reserved-slugs";

describe("web-builder reserved slugs", () => {
  it("normalizes accents and punctuation", () => {
    assert.equal(normalizeSiteSlug("URBA Nóva Loft!"), "urba-nova-loft");
    assert.equal(normalizeSiteSlug("  urbanovaloft  "), "urbanovaloft");
  });

  it("blocks PMS module paths but allows urbanovaloft", () => {
    assert.equal(isReservedPublicSlug("panel"), true);
    assert.equal(isReservedPublicSlug("web-builder"), true);
    assert.equal(isReservedPublicSlug("calendar"), true);
    assert.equal(isReservedPublicSlug("urbanovaloft"), false);
    assert.equal(isReservedPublicSlug("mi-hotel"), false);
  });

  it("treats empty slug as reserved", () => {
    assert.equal(isReservedPublicSlug(""), true);
    assert.equal(isReservedPublicSlug("---"), true);
  });
});
