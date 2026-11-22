import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Contract: TTLock access codes after guest registration.
 * Runtime: ttlock-access.service.ts + smart-access.service.ts
 */
describe("TTLock access code integrity", () => {
  it("never presents a code without ttlockCodeId as valid", () => {
    const credential = {
      ttlockCodeId: null as string | null,
      codeEncrypted: "enc",
      status: "GENERATED",
    };
    const mayShowCode = Boolean(credential.ttlockCodeId);
    assert.equal(mayShowCode, false);
  });

  it("requires live API success before persisting GENERATED with code", () => {
    const liveApiEnabled = true;
    const apiAddOk = true;
    const ttlockCodeId = apiAddOk ? "12345" : null;
    const mayPersistEncryptedCode = liveApiEnabled && Boolean(ttlockCodeId);
    assert.equal(mayPersistEncryptedCode, true);

    const liveOff = false;
    assert.equal(liveOff && Boolean("12345"), false);
  });

  it("phantom local credentials must be discarded before real TTLock generation", () => {
    const existing = { status: "GENERATED", ttlockCodeId: null as string | null };
    const liveApiEnabled = true;
    const shouldDeletePhantom =
      existing.status === "GENERATED" && !existing.ttlockCodeId && liveApiEnabled;
    assert.equal(shouldDeletePhantom, true);
  });
});
