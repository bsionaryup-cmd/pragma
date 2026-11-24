import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBlockedTestRecipient,
  isSyntheticGuestContext,
  isSyntheticGuestName,
} from "../../src/lib/email/email-safety";

describe("email safety", () => {
  it("blocks example/test recipients", () => {
    assert.equal(isBlockedTestRecipient("e2e-owner-x@example.com"), true);
    assert.equal(isBlockedTestRecipient("ops@hotel.com"), false);
  });

  it("detects synthetic guest names from audits/scripts", () => {
    assert.equal(isSyntheticGuestName("UIVis"), true);
    assert.equal(isSyntheticGuestName("E2E Titular-ABC"), true);
    assert.equal(isSyntheticGuestName("Guest-12345"), true);
    assert.equal(isSyntheticGuestName("Angie Suarez"), false);
  });

  it("detects synthetic guest context", () => {
    assert.equal(
      isSyntheticGuestContext({
        guestEmail: "e2e-owner-1@example.com",
        guestName: "E2E Titular",
      }),
      true,
    );
    assert.equal(
      isSyntheticGuestContext({
        guestEmail: "guest@real.com",
        guestName: "Carlos Pérez",
      }),
      false,
    );
  });
});
