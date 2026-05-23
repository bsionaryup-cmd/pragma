import {
  getWompiConfigFromEnv,
  type WompiConfig,
  type WompiEnvironment,
} from "@/modules/billing/config/wompi.config";
import {
  getWompiIntegrationForOrganization,
  hasWompiIntegrationDelegate,
  resolveStoredWompiSecret,
} from "@/modules/billing/services/wompi-persistence";
import {
  resolvePlatformWompiOrganizationId,
} from "@/modules/billing/services/wompi-platform.service";

export type WompiCredentialSource = "environment" | "database" | "both" | "none";

export type WompiCredentialStatus =
  | "missing"
  | "stored"
  | "environment"
  | "both"
  | "disabled";

export type WompiCredentialSnapshot = {
  configured: boolean;
  enabled: boolean;
  webhookReady: boolean;
  source: WompiCredentialSource;
  status: WompiCredentialStatus;
  hasStoredCredentials: boolean;
  hasEnvCredentials: boolean;
  env: WompiEnvironment;
  publicKey: string | null;
  publicKeyHint: string | null;
  privateKeyHint: string | null;
  eventsSecretHint: string | null;
  integritySecretHint: string | null;
  schemaReady: boolean;
  webhookPath: string;
  webhookUrl: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
};

function buildSecretHint(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

function buildPublicKeyHint(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 12)}…${trimmed.slice(-4)}`;
}

function resolveEnv(raw: string | null | undefined): WompiEnvironment {
  return raw?.trim() === "production" ? "production" : "test";
}

function buildConfigFromRow(
  row: {
    publicKey: string | null;
    privateKeyEncrypted: string | null;
    eventsSecretEncrypted: string | null;
    integritySecretEncrypted: string | null;
    env: string;
    enabled: boolean;
  },
  envConfig: WompiConfig,
): WompiConfig {
  const publicKey = row.publicKey;
  const privateKey = resolveStoredWompiSecret(row.privateKeyEncrypted);
  const eventsSecret = resolveStoredWompiSecret(row.eventsSecretEncrypted);
  const integritySecret = resolveStoredWompiSecret(row.integritySecretEncrypted);
  const env = resolveEnv(row.env);
  const configured = Boolean(
    row.enabled && publicKey && privateKey && eventsSecret && integritySecret,
  );

  return {
    ...envConfig,
    publicKey,
    privateKey,
    eventsSecret,
    integritySecret,
    env,
    configured,
  };
}

function mergeLegacyWompiConfig(
  db: {
    publicKey: string | null;
    privateKey: string | null;
    eventsSecret: string | null;
    integritySecret: string | null;
    env: WompiEnvironment;
  } | null,
  envConfig: WompiConfig,
): WompiConfig {
  if (!db) return envConfig;

  const publicKey = db.publicKey ?? envConfig.publicKey;
  const privateKey = db.privateKey ?? envConfig.privateKey;
  const eventsSecret = db.eventsSecret ?? envConfig.eventsSecret;
  const integritySecret = db.integritySecret ?? envConfig.integritySecret;
  const env = db.publicKey || db.privateKey ? db.env : envConfig.env;

  return {
    ...envConfig,
    publicKey,
    privateKey,
    eventsSecret,
    integritySecret,
    env,
    configured: Boolean(publicKey && privateKey),
  };
}

function resolvePublicWebhookUrl(): string | null {
  const envConfig = getWompiConfigFromEnv();
  if (envConfig.webhookUrl) return envConfig.webhookUrl;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!baseUrl) return null;

  const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  return `${origin.replace(/\/$/, "")}/api/payments/wompi/webhook`;
}

/** Platform-wide Wompi credentials for SaaS subscription checkout (all tenants). */
export async function resolvePlatformWompiConfig(): Promise<WompiConfig> {
  const envConfig = getWompiConfigFromEnv();
  const organizationId = await resolvePlatformWompiOrganizationId();
  if (!organizationId) {
    return envConfig.configured
      ? envConfig
      : { ...envConfig, configured: false };
  }
  return resolveWompiConfig(organizationId);
}

export async function getPlatformWompiCredentialSnapshot(): Promise<WompiCredentialSnapshot> {
  const organizationId = await resolvePlatformWompiOrganizationId();
  if (!organizationId) {
    const envConfig = getWompiConfigFromEnv();
    return {
      configured: envConfig.configured,
      enabled: envConfig.configured,
      webhookReady: Boolean(envConfig.eventsSecret),
      source: envConfig.configured ? "environment" : "none",
      status: envConfig.configured ? "environment" : "missing",
      hasStoredCredentials: false,
      hasEnvCredentials: envConfig.configured,
      env: envConfig.env,
      publicKey: null,
      publicKeyHint: buildPublicKeyHint(envConfig.publicKey),
      privateKeyHint: buildSecretHint(envConfig.privateKey),
      eventsSecretHint: buildSecretHint(envConfig.eventsSecret),
      integritySecretHint: buildSecretHint(envConfig.integritySecret),
      schemaReady: hasWompiIntegrationDelegate(),
      webhookPath: "/api/payments/wompi/webhook",
      webhookUrl: resolvePublicWebhookUrl(),
      lastHealthCheckAt: null,
      lastError: null,
    };
  }
  return getWompiCredentialSnapshot(organizationId);
}

/** Server-only: per-organization credentials (no cross-tenant env fallback). */
export async function resolveWompiConfig(
  organizationId: string,
): Promise<WompiConfig> {
  const envConfig = getWompiConfigFromEnv();
  const row = await getWompiIntegrationForOrganization(organizationId);

  if (!row) {
    return { ...envConfig, configured: false };
  }

  return buildConfigFromRow(row, envConfig);
}

/** Legacy bootstrap when organization cannot be resolved (env vars only). */
export async function resolveWompiConfigLegacy(): Promise<WompiConfig> {
  return getWompiConfigFromEnv();
}

export async function getWompiCredentialSnapshot(
  organizationId: string,
): Promise<WompiCredentialSnapshot> {
  const envConfig = getWompiConfigFromEnv();
  const row = await getWompiIntegrationForOrganization(organizationId);
  const resolved = await resolveWompiConfig(organizationId);

  const storedPrivate = row
    ? resolveStoredWompiSecret(row.privateKeyEncrypted)
    : null;
  const storedEvents = row
    ? resolveStoredWompiSecret(row.eventsSecretEncrypted)
    : null;
  const storedIntegrity = row
    ? resolveStoredWompiSecret(row.integritySecretEncrypted)
    : null;

  const hasStoredCredentials = Boolean(
    row?.publicKey && storedPrivate && storedEvents && storedIntegrity,
  );
  const hasEnvCredentials = envConfig.configured;

  let source: WompiCredentialSource = "none";
  let status: WompiCredentialStatus = "missing";

  if (hasStoredCredentials && hasEnvCredentials) {
    source = "both";
    status = "both";
  } else if (hasStoredCredentials) {
    source = "database";
    status = "stored";
  } else if (hasEnvCredentials) {
    source = "environment";
    status = "environment";
  }

  if (hasStoredCredentials && row && !row.enabled) {
    status = "disabled";
  }

  return {
    configured: resolved.configured,
    enabled: row?.enabled ?? false,
    webhookReady: Boolean(resolved.eventsSecret),
    source,
    status,
    hasStoredCredentials,
    hasEnvCredentials,
    env: resolved.env,
    publicKey: null,
    publicKeyHint: buildPublicKeyHint(resolved.publicKey),
    privateKeyHint: buildSecretHint(resolved.privateKey),
    eventsSecretHint: buildSecretHint(resolved.eventsSecret),
    integritySecretHint: buildSecretHint(resolved.integritySecret),
    schemaReady: hasWompiIntegrationDelegate(),
    webhookPath: "/api/payments/wompi/webhook",
    webhookUrl: resolvePublicWebhookUrl(),
    lastHealthCheckAt: row?.lastHealthCheckAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
  };
}

export async function isWompiConfiguredForOrganization(
  organizationId: string,
): Promise<boolean> {
  const config = await resolveWompiConfig(organizationId);
  return config.configured;
}

/** @deprecated Use resolveWompiConfig(organizationId) */
export async function resolveWompiConfigGlobal(): Promise<WompiConfig> {
  return mergeLegacyWompiConfig(null, getWompiConfigFromEnv());
}
