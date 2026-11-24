import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateWebDirectReservationCode,
  isWebBuilderReservationNotes,
} from "@/lib/web-builder/web-reservation-code";

describe("web reservation code", () => {
  it("generates WB-prefixed codes of stable length", () => {
    const code = generateWebDirectReservationCode();
    assert.match(code, /^WB[A-Z2-9]{8}$/);
  });

  it("detects WEB_BUILDER notes for channel branching", () => {
    assert.equal(
      isWebBuilderReservationNotes(
        "[WEB_BUILDER] origen=web_directa slug=urbanovaloft",
      ),
      true,
    );
    assert.equal(isWebBuilderReservationNotes("manual note"), false);
    assert.equal(isWebBuilderReservationNotes(null), false);
  });
});
