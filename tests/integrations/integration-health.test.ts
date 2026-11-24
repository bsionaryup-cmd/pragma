import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapAirbnbIcalToHealth,
  mapExternalIntegrationToHealth,
  mapPriceLabsOverviewToHealth,
  mapTTLockToHealth,
  type PriceLabsHealthInput,
} from "../../src/services/integrations/integration-health/derive-health";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function priceLabs(overrides: Partial<PriceLabsHealthInput> & {
  status?: string;
  lastError?: string | null;
  lastPricesSyncAt?: string | null;
  lastListingsSyncAt?: string | null;
} = {}): PriceLabsHealthInput {
  const { status, lastError, lastPricesSyncAt, lastListingsSyncAt, ...rest } = overrides;
  return {
    integration: {
      status: status ?? "CONNECTED",
      lastError: lastError ?? null,
      lastHealthCheckAt: null,
      lastListingsSyncAt:
        lastListingsSyncAt === undefined ? hoursAgo(2) : lastListingsSyncAt,
      lastPricesSyncAt: lastPricesSyncAt === undefined ? hoursAgo(1) : lastPricesSyncAt,
    },
    config: { liveApiEnabled: true, configured: true },
    syncing: false,
    properties: [{ syncStatus: "SYNCED" }],
    ...rest,
  };
}

describe("mapPriceLabsOverviewToHealth", () => {
  it("CONNECTED org + listing ERROR → DEGRADED", () => {
    const r = mapPriceLabsOverviewToHealth(
      priceLabs({ properties: [{ syncStatus: "SYNCED" }, { syncStatus: "ERROR" }] }),
      NOW,
    );
    assert.equal(r.status, "DEGRADED");
    assert.equal(r.canRecover, true);
    assert.ok(r.evidence.some((e) => e.includes("1 listing")));
  });

  it("org NOT_CONNECTED → DISCONNECTED (even with listing errors)", () => {
    const r = mapPriceLabsOverviewToHealth(
      priceLabs({
        status: "NOT_CONNECTED",
        properties: [{ syncStatus: "ERROR" }],
      }),
      NOW,
    );
    assert.equal(r.status, "DISCONNECTED");
    assert.equal(r.canRecover, false);
  });

  it("not configured → DISCONNECTED", () => {
    const r = mapPriceLabsOverviewToHealth(
      priceLabs({ config: { liveApiEnabled: true, configured: false } }),
      NOW,
    );
    assert.equal(r.status, "DISCONNECTED");
  });

  it("recent success + CONNECTED → CONNECTED", () => {
    const r = mapPriceLabsOverviewToHealth(priceLabs(), NOW);
    assert.equal(r.status, "CONNECTED");
    assert.equal(r.canRecover, false);
    assert.equal(r.lastSuccessAt, hoursAgo(1));
  });

  it("SYNC_REQUIRED but recent success and no error → CONNECTED", () => {
    const r = mapPriceLabsOverviewToHealth(priceLabs({ status: "SYNC_REQUIRED" }), NOW);
    assert.equal(r.status, "CONNECTED");
  });

  it("CONNECTED with stale success (>72h) → DEGRADED", () => {
    const r = mapPriceLabsOverviewToHealth(
      priceLabs({ lastListingsSyncAt: hoursAgo(100), lastPricesSyncAt: hoursAgo(90) }),
      NOW,
    );
    assert.equal(r.status, "DEGRADED");
  });

  it("CONNECTED without any recorded success → VERIFYING", () => {
    const r = mapPriceLabsOverviewToHealth(
      priceLabs({ lastListingsSyncAt: null, lastPricesSyncAt: null }),
      NOW,
    );
    assert.equal(r.status, "VERIFYING");
  });

  it("INVALID_KEY → NEEDS_ATTENTION and not recoverable", () => {
    const r = mapPriceLabsOverviewToHealth(priceLabs({ status: "INVALID_KEY" }), NOW);
    assert.equal(r.status, "NEEDS_ATTENTION");
    assert.equal(r.canRecover, false);
  });

  it("simulation mode never reports CONNECTED", () => {
    const r = mapPriceLabsOverviewToHealth(
      priceLabs({ config: { liveApiEnabled: false, configured: true } }),
      NOW,
    );
    assert.equal(r.status, "NEEDS_ATTENTION");
  });

  it("SYNC_FAILED with prior success → DEGRADED; without → NEEDS_ATTENTION", () => {
    assert.equal(
      mapPriceLabsOverviewToHealth(priceLabs({ status: "SYNC_FAILED" }), NOW).status,
      "DEGRADED",
    );
    assert.equal(
      mapPriceLabsOverviewToHealth(
        priceLabs({
          status: "SYNC_FAILED",
          lastListingsSyncAt: null,
          lastPricesSyncAt: null,
        }),
        NOW,
      ).status,
      "NEEDS_ATTENTION",
    );
  });

  it("syncing → VERIFYING", () => {
    assert.equal(
      mapPriceLabsOverviewToHealth(priceLabs({ syncing: true }), NOW).status,
      "VERIFYING",
    );
  });
});

describe("mapTTLockToHealth", () => {
  const base = {
    status: "CONNECTED",
    platformConfigured: true,
    accountConnected: true,
    hasAccessToken: true,
    hasRefreshToken: true,
    expiresAt: new Date(NOW.getTime() + 86_400_000).toISOString(),
    lastSyncedAt: hoursAgo(1),
    lastError: null,
  };

  it("healthy token + synced → CONNECTED", () => {
    assert.equal(mapTTLockToHealth(base, NOW).status, "CONNECTED");
  });
  it("expired token with refresh token → DEGRADED recoverable", () => {
    const r = mapTTLockToHealth({ ...base, expiresAt: hoursAgo(1) }, NOW);
    assert.equal(r.status, "DEGRADED");
    assert.equal(r.canRecover, true);
  });
  it("no tokens → DISCONNECTED", () => {
    const r = mapTTLockToHealth(
      { ...base, status: "NOT_CONNECTED", hasAccessToken: false, hasRefreshToken: false },
      NOW,
    );
    assert.equal(r.status, "DISCONNECTED");
  });
  it("INVALID_CREDENTIALS → NEEDS_ATTENTION, not recoverable", () => {
    const r = mapTTLockToHealth({ ...base, status: "INVALID_CREDENTIALS" }, NOW);
    assert.equal(r.status, "NEEDS_ATTENTION");
    assert.equal(r.canRecover, false);
  });
});

describe("mapAirbnbIcalToHealth", () => {
  it("no linked properties → DISCONNECTED", () => {
    const r = mapAirbnbIcalToHealth({ linkedCount: 0, lastSyncedAt: null, properties: [] }, NOW);
    assert.equal(r.status, "DISCONNECTED");
  });
  it("all recently synced → CONNECTED", () => {
    const r = mapAirbnbIcalToHealth(
      {
        linkedCount: 2,
        lastSyncedAt: hoursAgo(1),
        properties: [{ lastSyncedAt: hoursAgo(1) }, { lastSyncedAt: hoursAgo(3) }],
      },
      NOW,
    );
    assert.equal(r.status, "CONNECTED");
  });
  it("one property stale → DEGRADED", () => {
    const r = mapAirbnbIcalToHealth(
      {
        linkedCount: 2,
        lastSyncedAt: hoursAgo(1),
        properties: [{ lastSyncedAt: hoursAgo(1) }, { lastSyncedAt: hoursAgo(80) }],
      },
      NOW,
    );
    assert.equal(r.status, "DEGRADED");
    assert.equal(r.canRecover, true);
  });
  it("never synced → VERIFYING", () => {
    const r = mapAirbnbIcalToHealth(
      { linkedCount: 1, lastSyncedAt: null, properties: [{ lastSyncedAt: null }] },
      NOW,
    );
    assert.equal(r.status, "VERIFYING");
  });
});

describe("mapExternalIntegrationToHealth", () => {
  const row = {
    provider: "SIRE" as const,
    lastError: null,
    lastTestedAt: hoursAgo(5),
    hasCredentials: true,
  };
  it("CONNECTED → CONNECTED", () => {
    assert.equal(
      mapExternalIntegrationToHealth({ ...row, status: "CONNECTED" }).status,
      "CONNECTED",
    );
  });
  it("ERROR with credentials → NEEDS_ATTENTION recoverable (re-test)", () => {
    const r = mapExternalIntegrationToHealth({ ...row, status: "ERROR", lastError: "401" });
    assert.equal(r.status, "NEEDS_ATTENTION");
    assert.equal(r.canRecover, true);
    assert.equal(r.lastSuccessAt, null);
  });
  it("NOT_CONNECTED → DISCONNECTED", () => {
    const r = mapExternalIntegrationToHealth({
      ...row,
      provider: "TRAA",
      status: "NOT_CONNECTED",
      hasCredentials: false,
    });
    assert.equal(r.status, "DISCONNECTED");
    assert.equal(r.id, "traa");
  });
});
