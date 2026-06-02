import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGuestRegistrationAdminEmailHtml,
  buildGuestRegistrationAdminEmailSubject,
} from "../../src/services/guests/guest-registration-admin-notification.content";
import { sendEmail } from "../../src/lib/email/send-email";

describe("guest registration admin notification content", () => {
  const payload = {
    reservationCode: "HM123",
    propertyLabel: "Don Samuel · 801",
    checkIn: "2 jun 2026",
    checkOut: "5 jun 2026",
    primaryGuestName: "María López",
    documentType: "CC",
    documentNumber: "1234567890",
    email: "maria@example.com",
    phone: "+57 300 123 4567",
    guestCount: 3,
  };

  it("builds subject with reservation code when present", () => {
    assert.match(
      buildGuestRegistrationAdminEmailSubject("Don Samuel · 801", "HM123"),
      /HM123/,
    );
  });

  it("builds subject without code when missing", () => {
    const subject = buildGuestRegistrationAdminEmailSubject(
      "Don Samuel · 801",
      null,
    );
    assert.ok(!subject.includes("()"));
    assert.match(subject, /Don Samuel/);
  });

  it("includes required fields in html", () => {
    const html = buildGuestRegistrationAdminEmailHtml(payload);
    assert.match(html, /HM123/);
    assert.match(html, /Don Samuel/);
    assert.match(html, /María López/);
    assert.match(html, /1234567890/);
    assert.match(html, /maria@example.com/);
    assert.match(html, /Huéspedes registrados/);
    assert.match(html, />3</);
  });

  it("escapes html in guest data", () => {
    const html = buildGuestRegistrationAdminEmailHtml({
      ...payload,
      primaryGuestName: "<script>alert(1)</script>",
    });
    assert.ok(!html.includes("<script>"));
    assert.match(html, /&lt;script&gt;/);
  });
});

describe("guest registration admin notification delivery", () => {
  it("simulates successful delivery without RESEND_API_KEY", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail({
      to: "admin@edificio.com",
      subject: "Registro de huéspedes",
      html: "<p>test</p>",
    });

    assert.equal(result.ok, true);

    if (originalKey) process.env.RESEND_API_KEY = originalKey;
  });

  it("reports failure for invalid recipient without throwing", async () => {
    const result = await sendEmail({
      to: "",
      subject: "Registro de huéspedes",
      html: "<p>test</p>",
    });
    assert.equal(result.ok, false);
  });
});
