import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateWompiWebhookTimestamp,
  WEBHOOK_MAX_AGE_MS,
} from "../../src/modules/billing/lib/webhook-timestamp";

describe("validateWompiWebhookTimestamp", () => {
  it("accepts recent timestamps", () => {
    const result = validateWompiWebhookTimestamp({
      event: "transaction.updated",
      timestamp: Date.now() - 30_000,
    });
    assert.equal(result.valid, true);
  });

  it("rejects expired timestamps", () => {
    const result = validateWompiWebhookTimestamp({
      event: "transaction.updated",
      timestamp: Date.now() - WEBHOOK_MAX_AGE_MS - 1_000,
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, "timestamp_expired");
  });

  it("allows missing timestamp in non-strict mode", () => {
    const result = validateWompiWebhookTimestamp(
      { event: "transaction.updated" },
      { strict: false },
    );
    assert.equal(result.valid, true);
  });

  it("rejects missing timestamp in strict mode", () => {
    const result = validateWompiWebhookTimestamp(
      { event: "transaction.updated" },
      { strict: true },
    );
    assert.equal(result.valid, false);
    assert.equal(result.reason, "timestamp_missing");
  });
});
