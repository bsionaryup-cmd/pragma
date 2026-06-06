import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  mapEpaycoResponseCode,
  verifyEpaycoConfirmationSignature,
} from "../../src/modules/integrations/epayco/epayco-signature";

describe("ePayco confirmation signature", () => {
  it("verifies valid x_signature", () => {
    const custIdCliente = "499321";
    const refPayco = "12345";
    const transactionId = "999";
    const amount = "50000";
    const currencyCode = "COP";
    const pKey = "test-p-key";

    const payload = [custIdCliente, pKey, refPayco, transactionId, amount, currencyCode].join(
      "^",
    );
    const signature = createHash("sha256").update(payload).digest("hex");

    assert.equal(
      verifyEpaycoConfirmationSignature({
        custIdCliente,
        refPayco,
        transactionId,
        amount,
        currencyCode,
        pKey,
        signature,
      }),
      true,
    );
  });

  it("rejects tampered signature", () => {
    assert.equal(
      verifyEpaycoConfirmationSignature({
        custIdCliente: "1",
        refPayco: "2",
        transactionId: "3",
        amount: "100",
        currencyCode: "COP",
        pKey: "secret",
        signature: "deadbeef",
      }),
      false,
    );
  });

  it("maps response codes", () => {
    assert.equal(mapEpaycoResponseCode("1"), "APPROVED");
    assert.equal(mapEpaycoResponseCode("3"), "PENDING");
    assert.equal(mapEpaycoResponseCode("2"), "FAILED");
  });
});
