import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGuestRegistrationAdminEmailHtml,
  buildGuestRegistrationAdminEmailSubject,
  buildGuestRegistrationAdminEmailText,
} from "../../src/services/guests/guest-registration-admin-notification.content";
import {
  parseGuestRegistrationAdminNotificationLog,
  GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER,
} from "../../src/lib/guest-registration/guest-registration-admin-notification-log";
import { sendEmail } from "../../src/lib/email/send-email";

const payload = {
  reservationCode: "HM123",
  propertyLabel: "Don Samuel · 801",
  checkIn: "2 jun 2026",
  checkOut: "5 jun 2026",
  guestCount: 3,
  primaryGuest: {
    fullName: "María López",
    documentType: "CC",
    documentNumber: "1234567890",
    nationality: "Colombia",
    dateOfBirth: "12 mar 1990",
    email: "maria@example.com",
    phone: "+57 300 123 4567",
  },
  companions: [
    {
      fullName: "Juan Pérez",
      documentType: "CC",
      documentNumber: "9876543210",
      nationality: "Colombia",
      dateOfBirth: "5 ago 1992",
    },
  ],
};

describe("guest registration admin notification content", () => {
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

  it("includes primary guest, companions and branding in html", () => {
    const html = buildGuestRegistrationAdminEmailHtml(payload);
    assert.match(html, /HM123/);
    assert.match(html, /Don Samuel/);
    assert.match(html, /María López/);
    assert.match(html, /1234567890/);
    assert.match(html, /maria@example.com/);
    assert.match(html, /Colombia/);
    assert.match(html, /12 mar 1990/);
    assert.match(html, /Juan Pérez/);
    assert.match(html, /9876543210/);
    assert.match(html, /Acompañantes/);
    assert.match(html, /PRAGMA PMS/i);
    assert.match(html, />3</);
  });

  it("includes companion data in plain text", () => {
    const text = buildGuestRegistrationAdminEmailText(payload);
    assert.match(text, /Juan Pérez/);
    assert.match(text, /9876543210/);
    assert.match(text, /PRAGMA PMS/);
  });

  it("escapes html in guest data", () => {
    const html = buildGuestRegistrationAdminEmailHtml({
      ...payload,
      primaryGuest: {
        ...payload.primaryGuest,
        fullName: "<script>alert(1)</script>",
      },
    });
    assert.ok(!html.includes("<script>"));
    assert.match(html, /&lt;script&gt;/);
  });
});

describe("guest registration admin notification log", () => {
  it("parses valid log entries", () => {
    const entries = parseGuestRegistrationAdminNotificationLog([
      {
        at: "2026-07-16T10:00:00.000Z",
        status: "success",
        recipients: ["admin@edificio.com"],
        triggeredBy: "auto",
        providerIds: { "admin@edificio.com": "resend_1" },
      },
    ]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.status, "success");
    assert.equal(entries[0]?.providerIds?.["admin@edificio.com"], "resend_1");
  });

  it("ignores malformed log entries", () => {
    const entries = parseGuestRegistrationAdminNotificationLog([
      { at: "x", status: "broken" },
      null,
    ]);
    assert.equal(entries.length, 0);
  });

  it("exposes sending marker constant", () => {
    assert.equal(GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER, "__SENDING__");
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
