import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMailtoUrl,
  buildPedidoMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppDigits,
} from "../../src/domains/retail-intelligence/dispatch/message";

describe("pedido dispatch messages", () => {
  it("builds Spanish WhatsApp-ready message", () => {
    const text = buildPedidoMessage({
      supplierName: "Alpina",
      orderCode: "OC-1",
      lines: [
        { productName: "Leche Entera", quantity: 24 },
        { productName: "Yogurt", quantity: 18 },
      ],
    });
    assert.match(text, /Buenos días/);
    assert.match(text, /Alpina/);
    assert.match(text, /Leche Entera x24/);
    assert.match(text, /Muchas gracias/);
  });

  it("normalizes Colombia mobile for wa.me", () => {
    assert.equal(normalizeWhatsAppDigits("3001234567"), "573001234567");
    assert.equal(normalizeWhatsAppDigits("+57 300 123 4567"), "573001234567");
    const url = buildWhatsAppUrl("3001234567", "Hola");
    assert.ok(url?.startsWith("https://wa.me/573001234567?text="));
  });

  it("builds mailto with encoded body", () => {
    const url = buildMailtoUrl({
      email: "compras@alpina.com",
      supplierName: "Alpina",
      orderCode: "OC-1",
      body: "Pedido",
    });
    assert.ok(url.startsWith("mailto:compras@alpina.com?"));
    assert.match(url, /subject=/);
    assert.match(url, /body=/);
  });
});
