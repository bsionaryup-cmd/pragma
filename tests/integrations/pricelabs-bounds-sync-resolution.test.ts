import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectBoundsDrift,
  remoteDiffersFromStoredListing,
  resolveListingBoundsForSync,
} from "../../src/integrations/pricelabs/bounds-sync-resolution";
import type {
  PriceLabsListingRecord,
  StoredPriceLabsMeta,
} from "../../src/integrations/pricelabs/types";

function listing(
  partial: Partial<PriceLabsListingRecord> & { id?: string },
): PriceLabsListingRecord {
  return {
    id: partial.id ?? "1",
    pms: "airbnb",
    min: partial.min,
    base: partial.base,
    max: partial.max,
    last_pushed: partial.last_pushed,
    raw: partial.raw ?? {},
  };
}

describe("resolveListingBoundsForSync", () => {
  it("adopta remoto cuando difiere del snapshot local aunque last_date_pushed sea antiguo", () => {
    const priorMeta: StoredPriceLabsMeta = {
      bounds: {
        updatedAt: "2026-06-14T10:06:39.702Z",
        min: 161189,
        base: 235877,
        max: null,
      },
      listing: listing({ min: 161189, base: 235877 }),
    };
    const remote = listing({
      min: 157856,
      base: 239210,
      last_pushed: "2026-06-14T03:52:30.000Z",
      raw: { last_date_pushed: "2026-06-14T03:52:30.000Z" },
    });

    assert.equal(remoteDiffersFromStoredListing(remote, priorMeta), true);

    const resolution = resolveListingBoundsForSync(priorMeta, remote);
    assert.equal(resolution.adoptedFromRemote, true);
    assert.equal(resolution.bounds?.min, 157856);
    assert.equal(resolution.bounds?.base, 239210);
    assert.equal(detectBoundsDrift(priorMeta, remote, resolution).drifted, false);
  });

  it("mantiene local cuando remoto coincide con canónico tras push desde PRAGMA", () => {
    const priorMeta: StoredPriceLabsMeta = {
      bounds: {
        updatedAt: "2026-06-14T10:06:39.702Z",
        min: 161189,
        base: 235877,
        max: null,
      },
      listing: listing({ min: 161189, base: 235877 }),
    };
    const remote = listing({
      min: 161189,
      base: 235877,
      last_pushed: "2026-06-14T03:52:30.000Z",
    });

    const resolution = resolveListingBoundsForSync(priorMeta, remote);
    assert.equal(resolution.adoptedFromRemote, false);
    assert.equal(resolution.listing.min, 161189);
    assert.equal(detectBoundsDrift(priorMeta, remote, resolution).drifted, false);
  });

  it("adopta remoto cuando timestamp remoto es más reciente", () => {
    const priorMeta: StoredPriceLabsMeta = {
      bounds: {
        updatedAt: "2026-06-14T08:00:00.000Z",
        min: 100,
        base: 200,
        max: null,
      },
      listing: listing({ min: 100, base: 200 }),
    };
    const remote = listing({
      min: 110,
      base: 210,
      last_pushed: "2026-06-14T12:00:00.000Z",
    });

    const resolution = resolveListingBoundsForSync(priorMeta, remote);
    assert.equal(resolution.adoptedFromRemote, true);
    assert.equal(resolution.bounds?.min, 110);
  });
});
