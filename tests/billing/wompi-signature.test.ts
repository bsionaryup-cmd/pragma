import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildWompiIntegritySignature,
  computeWompiEventChecksum,
  verifyWompiEventChecksum,
} from "../../src/modules/billing/providers/wompi/wompi.signature";

describe("Wompi signature", () => {
  it("verifies event checksum with timing-safe compare", () => {
    const payload = '{"event":"transaction.updated"}';
    const secret = "test_secret";
    const signature = computeWompiEventChecksum(payload, secret);
    assert.equal(verifyWompiEventChecksum({ payload, signature, secret }), true);
    assert.equal(verifyWompiEventChecksum({ payload, signature: "bad", secret }), false);
  });

  it("builds integrity signature", () => {
    const sig = buildWompiIntegritySignature({
      reference: "ref-1",
      amountInCents: 19900000,
      currency: "COP",
      integritySecret: "integrity",
    });
    assert.equal(sig.length, 64);
  });
});
