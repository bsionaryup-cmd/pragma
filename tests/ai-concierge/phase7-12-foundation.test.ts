import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createConversationMemory,
  createToolRegistry,
  runConciergeTurn,
} from "@/modules/ai-concierge";
import { PLANNED_WRITE_TOOLS } from "@/modules/ai-concierge/tools/write/catalog";
import { recordLearningProposal, listLearningProposals } from "@/modules/ai-concierge/learning/proposals";
import {
  getOrCreateChannelSession,
  listChannelSessionSummaries,
} from "@/modules/ai-concierge/channel/session-store";

describe("ai-concierge F7-F12 foundation", () => {
  it("exposes write tool contracts from phase 10+", () => {
    const names = PLANNED_WRITE_TOOLS.map((t) => t.name);
    assert.ok(names.includes("create_direct_reservation"));
    assert.ok(names.includes("send_guest_registration_invite"));
    assert.equal(
      PLANNED_WRITE_TOOLS.find((t) => t.name === "create_direct_reservation")
        ?.enabledFromPhase,
      11,
    );
  });

  it("channel session store keeps memory per thread", () => {
    const a = getOrCreateChannelSession({
      organizationId: "org_a",
      channel: "whatsapp_web",
      threadId: "t1",
    });
    const b = getOrCreateChannelSession({
      organizationId: "org_a",
      channel: "whatsapp_web",
      threadId: "t1",
      guestLabel: "Maria",
    });
    assert.equal(a.id, b.id);
    assert.equal(b.guestLabel, "Maria");
    assert.ok(listChannelSessionSummaries("org_a").length >= 1);
  });

  it("learning proposals record OTHER without LLM", () => {
    const before = listLearningProposals(100).length;
    recordLearningProposal({
      organizationId: "org_a",
      question: "xyz",
      intent: "OTHER",
      reason: "ambiguous",
    });
    assert.equal(listLearningProposals(100).length, before + 1);
  });

  it("write tools stay planned before phase 10", async () => {
    const registry = createToolRegistry([
      {
        name: "create_operational_task",
        description: "x",
        risk: "write",
        enabledFromPhase: 10,
        inputSchemaHint: {},
      },
    ]);
    registry.registerHandler("create_operational_task", async () => ({
      ok: true,
      data: {},
    }));
    const inv = await registry.invoke({
      toolName: "create_operational_task",
      args: { title: "x" },
      currentPhase: 9,
    });
    assert.equal(inv.status, "planned");
  });

  it("orchestrator still blocks outbound", async () => {
    const conv = createConversationMemory({
      organizationId: "org",
      channel: "airbnb_web",
    });
    const { run } = await runConciergeTurn({
      conversation: conv,
      guestMessage: "wifi please",
      knownFacts: { wifiName: "A", wifiPassword: "B" },
    });
    assert.equal(run.outboundBlocked, true);
  });
});
