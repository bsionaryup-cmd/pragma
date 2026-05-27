import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeInboundRecipientList,
  parseInboundEmailAddress,
} from "../../src/services/integrations/tenant-airbnb-email-integration.service";

describe("inbound address normalization", () => {
  it("extrae email de display name", () => {
    assert.equal(
      parseInboundEmailAddress(
        "PRAGMA Inbound <loft-abc123@inbound.pragmapms.com>",
      ),
      "loft-abc123@inbound.pragmapms.com",
    );
  });

  it("normaliza lista con comas y mayúsculas", () => {
    const list = normalizeInboundRecipientList([
      "Loft <loft-abc123@INBOUND.PRAGMAPMS.COM>, other@x.com",
    ]);
    assert.deepEqual(list, [
      "loft-abc123@inbound.pragmapms.com",
      "other@x.com",
    ]);
  });
});
