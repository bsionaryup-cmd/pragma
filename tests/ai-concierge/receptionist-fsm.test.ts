import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDefaultPlaybook } from "@/modules/assistant-platform/defaults/concierge-defaults";
import { runReceptionistTurn } from "@/modules/digital-receptionist/runtime";

describe("receptionist FSM runtime", () => {
  it("Hola → welcome ask name from playbook", () => {
    const playbook = buildDefaultPlaybook();
    playbook.messages.welcome_ask_name = "HOLA-STUDIO ¿nombre?";
    const r = runReceptionistTurn({
      organizationId: "org",
      conversationId: "c1",
      threadId: "t1",
      guestMessage: "Hola",
      playbook,
      stored: { status: "WELCOME" },
    });
    assert.equal(r.handled, true);
    assert.match(r.reply ?? "", /HOLA-STUDIO/);
    assert.equal(r.state.status, "WELCOME");
  });

  it("name → menu options", () => {
    const playbook = buildDefaultPlaybook();
    const r = runReceptionistTurn({
      organizationId: "org",
      conversationId: "c1",
      threadId: "t1",
      guestMessage: "Rigo",
      playbook,
      stored: { status: "WELCOME" },
    });
    assert.equal(r.handled, true);
    assert.match(r.reply ?? "", /Rigo|1️⃣|Reservar/i);
    assert.equal(r.state.status, "MENU");
    assert.equal(r.state.variables.nombre, "Rigo");
  });

  it("digit 1 opens booking workflow", () => {
    const playbook = buildDefaultPlaybook();
    const r = runReceptionistTurn({
      organizationId: "org",
      conversationId: "c1",
      threadId: "t1",
      guestMessage: "1",
      playbook,
      stored: {
        status: "MENU",
        guestName: "Rigo",
        menuOffered: true,
        variables: { nombre: "Rigo" },
      },
    });
    assert.equal(r.handled, true);
    assert.equal(r.state.workflowKey, "booking");
    assert.match(r.reply ?? "", /disponibilidad|fechas|huéspedes/i);
  });

  it("3 personaa does not escalate to human from menu", () => {
    const playbook = buildDefaultPlaybook();
    const r = runReceptionistTurn({
      organizationId: "org",
      conversationId: "c1",
      threadId: "t1",
      guestMessage: "15 agosto\n16 agosto\n3 personaa",
      playbook,
      stored: {
        status: "BOOKING",
        workflowKey: "booking",
        nodeId: "booking_ask_dates",
        guestName: "Rigo",
        variables: { nombre: "Rigo" },
      },
    });
    assert.equal(r.handled, true);
    assert.notEqual(r.state.status, "HUMAN");
    assert.equal(r.escalate, false);
  });

  it("free-text on menu does NOT open booking via NL classify", () => {
    const playbook = buildDefaultPlaybook();
    const r = runReceptionistTurn({
      organizationId: "org",
      conversationId: "c1",
      threadId: "t1",
      guestMessage: "quiero reservar disponibilidad",
      playbook,
      stored: {
        status: "MENU",
        guestName: "Rigo",
        menuOffered: true,
        variables: { nombre: "Rigo" },
      },
    });
    assert.equal(r.handled, true);
    assert.equal(r.state.workflowKey, null);
    assert.equal(r.state.status, "MENU");
    assert.match(r.path, /menu_reprompt|fallback_menu/);
  });

  it("never returns handled:false (no Concierge passthrough)", () => {
    const playbook = buildDefaultPlaybook();
    const r = runReceptionistTurn({
      organizationId: "org",
      conversationId: "c1",
      threadId: "t1",
      guestMessage: "asdfxyz",
      playbook,
      stored: { status: "WELCOME" },
    });
    assert.equal(r.handled, true);
    assert.ok(r.reply && r.reply.length > 0);
  });

  it("greeting mid-flow resets session (no old memory)", () => {
    const playbook = buildDefaultPlaybook();
    playbook.messages.welcome_ask_name = "WELCOME-FRESH";
    const r = runReceptionistTurn({
      organizationId: "org",
      conversationId: "c1",
      threadId: "t1",
      guestMessage: "Hola",
      playbook,
      stored: {
        status: "MENU",
        guestName: "Rigo",
        menuOffered: true,
        variables: { nombre: "Rigo" },
        workflowKey: "booking",
        nodeId: "booking_ask_dates",
      },
    });
    assert.equal(r.handled, true);
    assert.equal(r.resetSession, true);
    assert.equal(r.state.status, "WELCOME");
    assert.equal(r.state.variables.nombre, undefined);
    assert.match(r.reply ?? "", /WELCOME-FRESH/);
  });
});
