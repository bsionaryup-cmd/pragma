import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeHeartbeatChannelRow,
  normalizeHeartbeatChannels,
} from "../../src/modules/ai-concierge/channel/heartbeat-channel-status";

describe("heartbeat channel status (honest WA Online)", () => {
  const now = new Date("2026-07-20T18:00:00.000Z");

  it("keeps whatsapp_web connected only with fresh tabAliveAt", () => {
    const row = normalizeHeartbeatChannelRow(
      "whatsapp_web",
      {
        connected: true,
        tabAliveAt: "2026-07-20T17:59:30.000Z",
      },
      now,
    ) as Record<string, unknown>;
    assert.equal(row.connected, true);
    assert.equal(row.at, now.toISOString());
  });

  it("forces whatsapp_web offline when tabAliveAt is stale", () => {
    const row = normalizeHeartbeatChannelRow(
      "whatsapp_web",
      {
        connected: true,
        tabAliveAt: "2026-07-20T17:50:00.000Z",
      },
      now,
    ) as Record<string, unknown>;
    assert.equal(row.connected, false);
    assert.equal(row.disconnectReason, "tab_alive_stale");
  });

  it("forces offline on needs_auth even with fresh tabAliveAt", () => {
    const row = normalizeHeartbeatChannelRow(
      "whatsapp_web",
      {
        connected: true,
        needs_auth: true,
        tabAliveAt: "2026-07-20T17:59:50.000Z",
      },
      now,
    ) as Record<string, unknown>;
    assert.equal(row.connected, false);
    assert.equal(row.disconnectReason, "needs_auth");
  });

  it("still renews airbnb connected rows without tabAliveAt", () => {
    const row = normalizeHeartbeatChannelRow(
      "airbnb_web",
      { connected: true, role: "leader" },
      now,
    ) as Record<string, unknown>;
    assert.equal(row.connected, true);
    assert.equal(row.at, now.toISOString());
  });

  it("normalizes a full channels map", () => {
    const out = normalizeHeartbeatChannels(
      {
        whatsapp_web: { connected: true },
        airbnb_web: { connected: true },
      },
      now,
    );
    assert.equal(
      (out?.whatsapp_web as Record<string, unknown>).connected,
      false,
    );
    assert.equal(
      (out?.airbnb_web as Record<string, unknown>).connected,
      true,
    );
  });
});
