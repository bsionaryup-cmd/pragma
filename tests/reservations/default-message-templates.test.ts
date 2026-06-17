import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  QUICK_MESSAGE_TYPE_ORDER,
  getQuickMessageButtonLabel,
} from "@/lib/default-message-templates";
import {
  applyQuickMessageTemplate,
  parseQuickMessageTemplates,
} from "@/lib/reservations/quick-message-templates";
import { buildQuickMessage } from "@/lib/reservations/quick-messages";

describe("default message templates", () => {
  it("defines seven guest journey stages in order", () => {
    assert.equal(QUICK_MESSAGE_TYPE_ORDER.length, 7);
    assert.deepEqual(QUICK_MESSAGE_TYPE_ORDER, [
      "WELCOME",
      "REGISTRATION",
      "ACCESS",
      "FOLLOW_UP",
      "HOUSE_RULES",
      "CHECKOUT",
      "REVIEW",
    ]);
  });

  it("merges arrival and access into ACCESS template", () => {
    const template = DEFAULT_MESSAGE_TEMPLATES.ACCESS;
    assert.match(template, /Dirección/);
    assert.match(template, /Código de acceso/);
    assert.match(template, /Instrucciones de acceso/);
    assert.match(template, /\{accessInstructions\}/);
  });

  it("keeps legacy stored templates and falls back for new stages", () => {
    const legacy = parseQuickMessageTemplates({
      WELCOME: "Hola {guestName}, reserva lista.",
      ACCESS: "Llegada personalizada {address}",
    });

    const welcome = buildQuickMessage(
      "WELCOME",
      { guestName: "Karla Durán", propertyName: "804" },
      legacy,
    );
    const rules = buildQuickMessage(
      "HOUSE_RULES",
      { guestName: "Karla", propertyName: "804" },
      legacy,
    );

    assert.match(welcome, /reserva lista/);
    assert.match(rules, /Recordatorios importantes/);
  });

  it("replaces guest variables when copying", () => {
    const text = applyQuickMessageTemplate(DEFAULT_MESSAGE_TEMPLATES.WELCOME, {
      guestName: "Jairo Tapia",
      propertyName: "Loft 804",
      stayRange: "23–27 jun",
      receptionWhatsapp: "+57 300 000 0000",
    });

    assert.match(text, /Hola Jairo/);
    assert.match(text, /Loft 804/);
    assert.match(text, /23–27 jun/);
    assert.doesNotMatch(text, /\{guestName\}/);
  });

  it("exposes emoji button labels for UI", () => {
    assert.match(getQuickMessageButtonLabel("REGISTRATION"), /Registro de huéspedes/);
    assert.match(getQuickMessageButtonLabel("REVIEW"), /Agradecimiento/);
  });
});
