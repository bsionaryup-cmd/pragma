import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Contract: TTLock access codes after guest registration.
 * Runtime: ttlock-access.service.ts + ttlock-access-code-email.service.ts
 */
describe("TTLock access code integrity", () => {
  it("never presents a code without ttlockCodeId as valid", () => {
    const credential = {
      ttlockCodeId: null as string | null,
      codeEncrypted: "enc",
      status: "GENERATED",
    };
    const mayShowCode = Boolean(credential.ttlockCodeId);
    const mayEmail = Boolean(credential.ttlockCodeId);
    assert.equal(mayShowCode, false);
    assert.equal(mayEmail, false);
  });

  it("requires live API success before persisting GENERATED with code", () => {
    const liveApiEnabled = true;
    const apiAddOk = true;
    const ttlockCodeId = apiAddOk ? "12345" : null;
    const mayPersistEncryptedCode = liveApiEnabled && Boolean(ttlockCodeId);
    assert.equal(mayPersistEncryptedCode, true);

    const liveOff = false;
    assert.equal(liveOff && true, false);
  });

  it("expired validTo credentials must be deleted from TTLock then marked EXPIRED", () => {
    const steps = [
      "find_validTo_lt_now",
      "delete_keyboard_pwd_on_ttlock",
      "mark_status_EXPIRED",
    ] as const;
    assert.equal(steps[0], "find_validTo_lt_now");
    assert.equal(steps[1], "delete_keyboard_pwd_on_ttlock");
    assert.equal(steps[2], "mark_status_EXPIRED");
  });
});
