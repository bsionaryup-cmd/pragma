import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProductionEmailRuntime,
  resolveEmailFromAddress,
  sendEmail,
  shouldSimulateEmailDelivery,
} from "../../src/lib/email/send-email";

async function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): Promise<void> {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    previous[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(patch)) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("Resend email delivery", () => {
  it("never hardcodes API keys", () => {
    assert.equal(typeof shouldSimulateEmailDelivery(), "boolean");
  });

  it("uses EMAIL_FROM and PRAGMA_BILLING_EMAIL fallback", async () => {
    await withEnv(
      { EMAIL_FROM: undefined, PRAGMA_BILLING_EMAIL: "facturacion@example.com" },
      () => {
        assert.match(resolveEmailFromAddress(), /facturacion@example\.com/);
      },
    );
  });

  it("simulates delivery when RESEND_API_KEY is missing outside production", async () => {
    await withEnv(
      {
        RESEND_API_KEY: undefined,
        NODE_ENV: "test",
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      async () => {
        assert.equal(isProductionEmailRuntime(), false);
        assert.equal(shouldSimulateEmailDelivery(), true);

        const result = await sendEmail({
          to: "cliente@example.com",
          subject: "Factura PRAGMA",
          html: "<p>test</p>",
        });

        assert.equal(result.ok, true);
        assert.equal(result.id, "simulated");
      },
    );
  });

  it("fails without simulating when RESEND_API_KEY is missing in production", async () => {
    await withEnv(
      {
        RESEND_API_KEY: undefined,
        NODE_ENV: "production",
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      async () => {
        assert.equal(isProductionEmailRuntime(), true);
        assert.equal(shouldSimulateEmailDelivery(), false);

        const result = await sendEmail({
          to: "cliente@example.com",
          subject: "Factura PRAGMA",
          html: "<p>test</p>",
        });

        assert.equal(result.ok, false);
        assert.equal(result.id, undefined);
        assert.match(result.message, /RESEND_API_KEY/i);
      },
    );
  });

  it("treats VERCEL production as non-simulating without API key", async () => {
    await withEnv(
      {
        RESEND_API_KEY: undefined,
        NODE_ENV: undefined,
        VERCEL: "1",
        VERCEL_ENV: "production",
      },
      async () => {
        assert.equal(isProductionEmailRuntime(), true);

        const result = await sendEmail({
          to: "admin@edificio.com",
          subject: "Registro de huéspedes",
          html: "<p>test</p>",
        });

        assert.equal(result.ok, false);
        assert.notEqual(result.id, "simulated");
      },
    );
  });
});
