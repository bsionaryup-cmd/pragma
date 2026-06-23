import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWhatsAppLink,
  buildWhatsAppLinkWithMessage,
} from "@/lib/prospecting/whatsapp-link";

describe("prospecting whatsapp links", () => {
  it("normalizes Colombian mobile numbers", () => {
    assert.equal(buildWhatsAppLink("+57 300 123 4567"), "https://wa.me/573001234567");
    assert.equal(buildWhatsAppLink("3001234567"), "https://wa.me/573001234567");
  });

  it("returns null for empty phone", () => {
    assert.equal(buildWhatsAppLink(null), null);
    assert.equal(buildWhatsAppLink(""), null);
  });

  it("appends encoded message when provided", () => {
    const link = buildWhatsAppLinkWithMessage("3001234567", "Hola, ¿cómo estás?");
    assert.ok(link?.includes("https://wa.me/573001234567"));
    assert.ok(link?.includes("text="));
  });
});
