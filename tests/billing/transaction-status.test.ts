import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PaymentTransactionStatus } from "@prisma/client";
import { wompiAdapter } from "../../src/modules/billing/providers/wompi/wompi.adapter";

describe("Wompi status mapping", () => {
  it("maps lifecycle statuses", () => {
    assert.equal(
      wompiAdapter.mapProviderStatus("APPROVED"),
      PaymentTransactionStatus.APPROVED,
    );
    assert.equal(
      wompiAdapter.mapProviderStatus("DECLINED"),
      PaymentTransactionStatus.DECLINED,
    );
    assert.equal(
      wompiAdapter.mapProviderStatus("ERROR"),
      PaymentTransactionStatus.FAILED,
    );
  });
});
