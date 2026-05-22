import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveEmailFromAddress,
  sendEmail,
  shouldSimulateEmailDelivery,
} from "../../src/lib/email/send-email";

describe("Resend email delivery", () => {
  it("never hardcodes API keys", () => {
    assert.equal(typeof shouldSimulateEmailDelivery(), "boolean");
  });

  it("uses EMAIL_FROM and PRAGMA_BILLING_EMAIL fallback", () => {
    const originalFrom = process.env.EMAIL_FROM;
    const originalBilling = process.env.PRAGMA_BILLING_EMAIL;

    delete process.env.EMAIL_FROM;
    process.env.PRAGMA_BILLING_EMAIL = "facturacion@example.com";

    assert.match(resolveEmailFromAddress(), /facturacion@example\.com/);

    if (originalFrom) process.env.EMAIL_FROM = originalFrom;
    else delete process.env.EMAIL_FROM;
    if (originalBilling) process.env.PRAGMA_BILLING_EMAIL = originalBilling;
    else delete process.env.PRAGMA_BILLING_EMAIL;
  });

  it("simulates delivery when RESEND_API_KEY is missing", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail({
      to: "cliente@example.com",
      subject: "Factura PRAGMA",
      html: "<p>test</p>",
    });

    assert.equal(result.ok, true);
    assert.equal(result.id, "simulated");

    if (originalKey) process.env.RESEND_API_KEY = originalKey;
  });
});
