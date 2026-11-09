import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors canManageInvoice in owner-tenant-detail-view */
function canManageInvoice(status: string) {
  return status === "OPEN" || status === "FAILED" || status === "DRAFT";
}

describe("owner invoice management guards", () => {
  it("allows edit/pay/void only for open, failed, or draft invoices", () => {
    assert.equal(canManageInvoice("OPEN"), true);
    assert.equal(canManageInvoice("FAILED"), true);
    assert.equal(canManageInvoice("DRAFT"), true);
    assert.equal(canManageInvoice("PAID"), false);
    assert.equal(canManageInvoice("VOID"), false);
  });
});
