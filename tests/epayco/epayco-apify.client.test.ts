import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractEpaycoAuthToken } from "../../src/modules/integrations/epayco/epayco-apify.client";

describe("ePayco Apify auth token", () => {
  it("reads bearer_token at root", () => {
    assert.equal(
      extractEpaycoAuthToken({ bearer_token: "abc123" }),
      "abc123",
    );
  });

  it("reads token nested in data", () => {
    assert.equal(
      extractEpaycoAuthToken({ success: true, data: { token: "nested" } }),
      "nested",
    );
  });

  it("returns undefined when token is missing", () => {
    assert.equal(extractEpaycoAuthToken({ success: true, data: {} }), undefined);
  });
});
