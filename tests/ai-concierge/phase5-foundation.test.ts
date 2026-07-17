import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALWAYS_ESCALATE_INTENTS,
  CONCIERGE_INTENTS,
  appendMessage,
  auditConciergeCandidate,
  createConversationMemory,
  createToolRegistry,
  detectConciergeIntent,
  getConciergeIntentDefinition,
  listConciergeIntentDefinitions,
  runConciergeTurn,
} from "@/modules/ai-concierge";
import { renderIntentTemplate } from "@/modules/ai-concierge/intent/library";

describe("ai-concierge Fase 5 foundation", () => {
  it("exposes master-doc intent library", () => {
    assert.ok(CONCIERGE_INTENTS.includes("WIFI"));
    assert.ok(CONCIERGE_INTENTS.includes("TTLOCK"));
    assert.ok(CONCIERGE_INTENTS.includes("GUEST_REGISTRATION"));
    assert.equal(listConciergeIntentDefinitions().length, CONCIERGE_INTENTS.length);
  });

  it("detects WIFI deterministically without LLM", () => {
    const d = detectConciergeIntent("Hola, ¿cuál es la clave del WiFi?");
    assert.equal(d.intent, "WIFI");
    assert.equal(d.level, "L1");
    assert.equal(d.source, "concierge-rules");
  });

  it("escalates refunds and emergencies by policy definition", () => {
    assert.equal(getConciergeIntentDefinition("REFUND").alwaysEscalate, true);
    assert.equal(getConciergeIntentDefinition("EMERGENCY").alwaysEscalate, true);
    assert.ok(ALWAYS_ESCALATE_INTENTS.has("DISCOUNT"));
  });

  it("keeps conversation memory immutable-append style", () => {
    const conv = createConversationMemory({
      organizationId: "org_test",
      channel: "airbnb_web",
      reservationId: "res_1",
    });
    const { conversation, message } = appendMessage(conv, {
      role: "guest",
      body: "Hola",
    });
    assert.equal(conv.messages.length, 0);
    assert.equal(conversation.messages.length, 1);
    assert.equal(message.role, "guest");
  });

  it("renders templates without inventing missing facts", () => {
    const { text, unresolved } = renderIntentTemplate(
      "Red {{wifiName}} pass {{wifiPassword}}",
      { wifiName: "PragmaGuest" },
    );
    assert.match(text, /PragmaGuest/);
    assert.deepEqual(unresolved, ["wifiPassword"]);
  });

  it("auditor rejects unverified drafts", () => {
    const result = auditConciergeCandidate({
      draft: "La clave es secreta123",
      knownFacts: { wifiName: "X", wifiPassword: "otra" },
      requiredFacts: ["wifiName", "wifiPassword"],
    });
    assert.equal(result.verified, false);
    assert.ok(result.issues.length > 0);
  });

  it("tool registry plans but does not execute in phase 5", async () => {
    const registry = createToolRegistry();
    const inv = await registry.invoke({
      toolName: "get_property_guest_info",
      args: { propertyId: "p1" },
      currentPhase: 5,
    });
    assert.equal(inv.status, "planned");
    assert.equal(inv.result?.ok, false);
  });

  it("orchestrator resolves WIFI with facts, never sends", async () => {
    const conv = createConversationMemory({
      organizationId: "org_test",
      channel: "whatsapp_web",
      propertyId: "prop_1",
    });
    const { run } = await runConciergeTurn({
      conversation: conv,
      guestMessage: "¿Cuál es el WiFi?",
      knownFacts: {
        wifiName: "PragmaNet",
        wifiPassword: "clave-segura",
      },
      currentPhase: 5,
    });
    assert.equal(run.intent.intent, "WIFI");
    assert.equal(run.decision.path, "deterministic");
    assert.equal(run.outboundBlocked, true);
    assert.ok(run.decision.draftResponse?.includes("PragmaNet"));
    assert.ok(run.decision.draftResponse?.includes("clave-segura"));
    assert.equal(run.auditor.verified, true);
  });

  it("orchestrator asks tools when facts missing (no invent)", async () => {
    const conv = createConversationMemory({
      organizationId: "org_test",
      channel: "airbnb_web",
    });
    const { run } = await runConciergeTurn({
      conversation: conv,
      guestMessage: "necesito el código de acceso ttlock",
      knownFacts: {},
      currentPhase: 5,
    });
    assert.equal(run.intent.intent, "TTLOCK");
    assert.equal(run.decision.path, "needs_tools");
    assert.ok(run.toolInvocations.length > 0);
    assert.equal(run.toolInvocations[0]?.status, "planned");
    assert.equal(run.decision.draftResponse, null);
    assert.equal(run.outboundBlocked, true);
  });

  it("orchestrator escalates emergencies without draft", async () => {
    const conv = createConversationMemory({
      organizationId: "org_test",
      channel: "airbnb_web",
    });
    const { run } = await runConciergeTurn({
      conversation: conv,
      guestMessage: "Es urgente, hay un incendio",
    });
    assert.equal(run.intent.intent, "EMERGENCY");
    assert.equal(run.decision.path, "escalate");
    assert.equal(run.decision.draftResponse, null);
    assert.equal(run.outboundBlocked, true);
  });

  it("defers LLM for ambiguous OTHER without calling provider", async () => {
    const conv = createConversationMemory({
      organizationId: "org_test",
      channel: "internal",
    });
    const { run } = await runConciergeTurn({
      conversation: conv,
      guestMessage: "asdf qwerty zxcv",
    });
    assert.equal(run.intent.intent, "OTHER");
    assert.equal(run.decision.path, "needs_llm");
    assert.equal(run.outboundBlocked, true);
  });
});
