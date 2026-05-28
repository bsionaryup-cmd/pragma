import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guestNameMatchStrength,
  guestNamesEquivalent,
  normalizeGuestName,
} from "../../src/modules/airbnb-email/matching/guest-name-normalize";

describe("guest-name-normalize", () => {
  it("folds accents and case", () => {
    assert.equal(normalizeGuestName("Karla Durán"), "karla duran");
    assert.equal(normalizeGuestName("KARLA DURAN"), "karla duran");
  });

  it("treats accent and spelling variants as equivalent", () => {
    assert.equal(guestNamesEquivalent("Karla Durán", "Karla Duran"), true);
    assert.equal(guestNamesEquivalent("Karla", "Karla Durán"), true);
    assert.equal(guestNameMatchStrength("Karla Durán", "Karla Duran"), 1);
  });

  it("rejects unrelated guests", () => {
    assert.equal(guestNamesEquivalent("Karla Durán", "Pedro López"), false);
    assert.equal(guestNameMatchStrength("Karla", "Carlos"), 0);
  });
});
