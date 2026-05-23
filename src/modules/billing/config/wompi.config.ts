import { PaymentProviderNotConfiguredError } from "@/modules/billing/domain/errors";

export type WompiEnvironment = "test" | "production";

export type WompiConfig = {
  publicKey: string | null;
  privateKey: string | null;
  eventsSecret: string | null;
  integritySecret: string | null;
  env: WompiEnvironment;
  webhookUrl: string | null;
  baseUrl: string;
  configured: boolean;
};

function resolveBaseUrl(env: WompiEnvironment, override?: string): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  return env === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

export function getWompiConfigFromEnv(): WompiConfig {
  const envRaw = process.env.WOMPI_ENV?.trim() || "test";
  const env: WompiEnvironment = envRaw === "production" ? "production" : "test";

  return {
    publicKey: process.env.WOMPI_PUBLIC_KEY?.trim() || null,
    privateKey: process.env.WOMPI_PRIVATE_KEY?.trim() || null,
    eventsSecret: process.env.WOMPI_EVENTS_SECRET?.trim() || null,
    integritySecret: process.env.WOMPI_INTEGRITY_SECRET?.trim() || null,
    env,
    webhookUrl: process.env.WOMPI_WEBHOOK_URL?.trim() || null,
    baseUrl: resolveBaseUrl(env, process.env.WOMPI_BASE_URL),
    configured: Boolean(
      process.env.WOMPI_PUBLIC_KEY?.trim() &&
        process.env.WOMPI_PRIVATE_KEY?.trim(),
    ),
  };
}

/** @deprecated Prefer resolveWompiConfig() for server-side reads (includes DB). */
export function getWompiConfig(): WompiConfig {
  return getWompiConfigFromEnv();
}

export async function assertWompiConfigured(
  organizationId: string,
): Promise<WompiConfig> {
  const { resolveWompiConfig } = await import(
    "@/modules/billing/services/wompi-credentials"
  );
  const config = await resolveWompiConfig(organizationId);
  if (!config.configured) {
    throw new PaymentProviderNotConfiguredError("WOMPI");
  }
  return config;
}
