import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAccessCodeGuestMessage } from "../../src/lib/access-code-guest-message";

describe("access code guest message", () => {
  const ctx = {
    code: "12345",
    propertyType: "LOFT" as const,
    propertyName: "Loft 801",
    unitNumber: "801",
    checkIn: "2026-07-20",
    checkOut: "2026-07-23",
    checkInTime: "15:00",
    checkOutTime: "13:00",
  };

  it("uses markdown emphasis by default for clipboard/WhatsApp", () => {
    const message = buildAccessCodeGuestMessage(ctx);
    assert.ok(message);
    assert.match(message!, /\*\*12345#\*\*/);
  });

  it("renders plain TTLock code for email without markdown asterisks", () => {
    const message = buildAccessCodeGuestMessage(ctx, { codeStyle: "plain" });
    assert.ok(message);
    assert.match(message!, /12345#/);
    assert.ok(!message!.includes("**12345#**"));
    assert.ok(!message!.includes("**"));
  });
});
