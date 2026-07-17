import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  createConciergeExtensionSession,
  createConciergePairingSecret,
  hashConciergeDeviceId,
  hashConciergePairingSecret,
  verifyConciergeExtensionSession,
} from "@/modules/ai-concierge/channel/session-token";
import { createPhase6ReadToolRegistry } from "@/modules/ai-concierge/tools/read/wire";

describe("AI Concierge native PRAGMA integration", () => {
  it("signs and verifies a short-lived tenant-scoped extension session", () => {
    process.env.CONCIERGE_EXTENSION_SECRET = "test-secret-at-least-local";
    const deviceHash = hashConciergeDeviceId("device-local-123456");
    const session = createConciergeExtensionSession({
      linkId: "link_1",
      organizationId: "org_1",
      userId: "user_1",
      deviceHash,
    });
    const payload = verifyConciergeExtensionSession(session.token);
    assert.equal(payload?.organizationId, "org_1");
    assert.equal(payload?.userId, "user_1");
    assert.equal(payload?.deviceHash, deviceHash);
  });

  it("rejects tampered extension sessions", () => {
    process.env.CONCIERGE_EXTENSION_SECRET = "test-secret-at-least-local";
    const session = createConciergeExtensionSession({
      linkId: "link_1",
      organizationId: "org_1",
      userId: "user_1",
      deviceHash: hashConciergeDeviceId("device-local-123456"),
    });
    assert.equal(
      verifyConciergeExtensionSession(`${session.token.slice(0, -1)}x`),
      null,
    );
  });

  it("stores only a hash of the one-time pairing secret", () => {
    const pairing = createConciergePairingSecret();
    assert.notEqual(pairing.raw, pairing.hash);
    assert.equal(hashConciergePairingSecret(pairing.raw), pairing.hash);
  });

  it("removes popup credentials and client-controlled tenant headers", () => {
    const background = readFileSync(
      "extensions/pragma-ai-concierge/background.js",
      "utf8",
    );
    const manifest = JSON.parse(
      readFileSync("extensions/pragma-ai-concierge/manifest.json", "utf8"),
    ) as {
      action?: { default_popup?: string };
      externally_connectable?: { matches?: string[] };
    };
    assert.equal(manifest.action?.default_popup, undefined);
    assert.ok((manifest.externally_connectable?.matches?.length ?? 0) > 0);
    assert.equal(background.includes("chrome.storage.sync"), false);
    assert.equal(background.includes("x-concierge-user-id"), false);
    assert.equal(background.includes("x-concierge-org-id"), false);
    assert.equal(background.includes("x-concierge-mode"), false);
    assert.equal(background.includes("ngrok-skip-browser-warning"), true);
    assert.equal(background.includes("Heartbeat falló"), true);
  });

  it("denies tools excluded by the server-side allowlist", async () => {
    const registry = createPhase6ReadToolRegistry({
      scope: { organizationId: "org_1", userId: "user_1" },
      allowedTools: ["get_property_guest_info"],
      allowedPropertyIds: ["property_1"],
    });
    const denied = await registry.invoke({
      toolName: "search_reservations",
      args: { query: "guest" },
      currentPhase: 6,
    });
    assert.equal(denied.status, "denied");
  });
});
