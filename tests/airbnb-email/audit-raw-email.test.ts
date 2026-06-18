import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAuditRawEmailPayload } from "@/modules/airbnb-email/parsing/audit-raw-email";
import { buildEmailBody } from "@/modules/airbnb-email/parsing/extractors";

describe("audit raw email payload", () => {
  it("merges provider metadata with html and text body", () => {
    const payload = buildAuditRawEmailPayload({
      from: "express@airbnb.com",
      to: "host@inbound.test",
      subject: "RE: Reserva de loft",
      html: "<p>Hola Karla</p>",
      text: "Karla\nPersona que reserva\nHola, llegamos mañana",
      raw: { provider: "resend", emailId: "email-123" },
    }) as Record<string, unknown>;

    assert.equal(payload.provider, "resend");
    assert.equal(payload.emailId, "email-123");
    assert.match(String(payload.text), /llegamos mañana/i);

    const body = buildEmailBody({
      subject: String(payload.subject),
      html: typeof payload.html === "string" ? payload.html : null,
      text: typeof payload.text === "string" ? payload.text : null,
    });
    assert.match(body, /llegamos mañana/i);
  });
});
