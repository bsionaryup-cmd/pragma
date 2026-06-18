import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectInboxMessageIntent, inboxIntentLabel } from "@/services/inbox-ai/inbox-intent.service";
import { INBOX_AI_INTENTS } from "@/services/inbox-ai/inbox-intent.types";

describe("inbox intent detection", () => {
  it("exposes 15 unified intents", () => {
    assert.equal(INBOX_AI_INTENTS.length, 15);
  });

  it("detects wifi questions", () => {
    const result = detectInboxMessageIntent("Hola, ¿cuál es la clave del WiFi?");
    assert.equal(result.intent, "WIFI");
    assert.equal(inboxIntentLabel(result.intent), "WiFi");
  });

  it("detects parking before generic check-in", () => {
    const result = detectInboxMessageIntent("¿Hay parqueadero cerca para el check-in?");
    assert.equal(result.intent, "PARKING");
  });

  it("detects emergencies", () => {
    const result = detectInboxMessageIntent("Es urgente, no podemos entrar");
    assert.equal(result.intent, "EMERGENCY");
  });

  it("maps legacy airbnb transport intent to location", () => {
    const result = detectInboxMessageIntent("Necesito coordinar el traslado", {
      legacyAirbnbIntent: "TRANSPORT",
    });
    assert.equal(result.intent, "LOCATION");
    assert.equal(result.source, "legacy-airbnb-email");
  });

  it("falls back to OTHER for empty messages", () => {
    const result = detectInboxMessageIntent("   ");
    assert.equal(result.intent, "OTHER");
  });
});
