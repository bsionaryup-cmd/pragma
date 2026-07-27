import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWompiIntegritySignature,
  computeWompiEventChecksumFromEvent,
  resolveWompiDataProperty,
  verifyWompiEventChecksum,
} from "../../src/modules/billing/providers/wompi/wompi.signature";

describe("Wompi signature", () => {
  it("resolves nested data properties", () => {
    assert.equal(
      resolveWompiDataProperty(
        { transaction: { id: "1234-1610641025-49201", status: "APPROVED" } },
        "transaction.id",
      ),
      "1234-1610641025-49201",
    );
  });

  it("verifies official event checksum (properties + timestamp + secret)", () => {
    // Example shape from Wompi docs (colombia/eventos)
    const event = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "1234-1610641025-49201",
          status: "APPROVED",
          amount_in_cents: 4490000,
        },
      },
      signature: {
        properties: [
          "transaction.id",
          "transaction.status",
          "transaction.amount_in_cents",
        ],
        checksum: "",
      },
      timestamp: 1530291411,
    };
    const secret = "test_secret_Q93Z";
    const checksum = computeWompiEventChecksumFromEvent(event, secret);
    event.signature.checksum = checksum;

    const payload = JSON.stringify(event);
    assert.equal(
      verifyWompiEventChecksum({
        payload,
        signature: checksum,
        secret,
      }),
      true,
    );
    assert.equal(
      verifyWompiEventChecksum({
        payload,
        signature: "bad",
        secret,
      }),
      false,
    );
    assert.equal(
      verifyWompiEventChecksum({
        payload,
        signature: checksum.toLowerCase(),
        secret,
      }),
      true,
    );
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
