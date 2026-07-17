import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createConversationMemory,
  createToolRegistry,
  runConciergeTurn,
} from "@/modules/ai-concierge";
import { PLANNED_READ_TOOLS } from "@/modules/ai-concierge/tools/registry";

describe("ai-concierge Fase 6 read tools", () => {
  it("catalog lists all priority read tools", () => {
    const names = PLANNED_READ_TOOLS.map((t) => t.name);
    for (const required of [
      "search_reservations",
      "get_reservation",
      "get_property_guest_info",
      "get_guest_registration_status",
      "get_access_status",
      "search_availability",
      "get_calendar",
      "get_payment_balance",
      "list_payment_links",
      "get_operational_contacts",
      "calculate_stay_quote",
    ]) {
      assert.ok(names.includes(required), `missing ${required}`);
    }
  });

  it("phase 5 still plans tools without executing handlers", async () => {
    const registry = createToolRegistry();
    registry.registerHandler("get_property_guest_info", async () => ({
      ok: true,
      data: { wifiName: "should-not-run" },
    }));
    const inv = await registry.invoke({
      toolName: "get_property_guest_info",
      args: { propertyId: "p1" },
      currentPhase: 5,
    });
    assert.equal(inv.status, "planned");
  });

  it("phase 6 executes registered read handler", async () => {
    const registry = createToolRegistry();
    registry.registerHandler("get_property_guest_info", async (input) => {
      const propertyId = (input as { propertyId?: string }).propertyId;
      assert.equal(propertyId, "prop_x");
      return {
        ok: true,
        data: {
          wifiName: "PragmaNet",
          wifiPassword: "secret",
          houseRules: "No fiestas",
          address: "Calle 1",
        },
      };
    });
    const inv = await registry.invoke({
      toolName: "get_property_guest_info",
      args: { propertyId: "prop_x" },
      currentPhase: 6,
    });
    assert.equal(inv.status, "executed");
    assert.equal(inv.result?.ok, true);
    assert.equal(
      (inv.result?.data as { wifiName: string }).wifiName,
      "PragmaNet",
    );
  });

  it("orchestrator at phase 6 invokes tools when facts missing", async () => {
    const registry = createToolRegistry();
    let called = false;
    registry.registerHandler("get_access_status", async () => {
      called = true;
      return {
        ok: true,
        data: {
          accessCode: "123456#",
          accessValidFrom: "2026-07-01T15:00:00.000Z",
          accessValidTo: "2026-07-05T13:00:00.000Z",
        },
      };
    });
    const conv = createConversationMemory({
      organizationId: "org_test",
      channel: "whatsapp_web",
      reservationId: "res_1",
    });
    const { run } = await runConciergeTurn({
      conversation: conv,
      guestMessage: "necesito el código ttlock de la puerta",
      knownFacts: {},
      currentPhase: 6,
      toolRegistry: registry,
    });
    assert.equal(run.intent.intent, "TTLOCK");
    assert.equal(run.decision.path, "needs_tools");
    assert.equal(called, true);
    assert.equal(run.toolInvocations[0]?.status, "executed");
    assert.equal(run.outboundBlocked, true);
  });

  it("unknown tool is denied", async () => {
    const registry = createToolRegistry();
    const inv = await registry.invoke({
      toolName: "delete_everything",
      args: {},
      currentPhase: 6,
    });
    assert.equal(inv.status, "denied");
  });
});
