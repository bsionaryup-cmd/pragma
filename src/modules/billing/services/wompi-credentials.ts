import {
  getWompiConfigFromEnv,
  type WompiConfig,
  type WompiEnvironment,
} from "@/modules/billing/config/wompi.config";
import {
  getWompiIntegrationSafe,
  hasWompiIntegrationDelegate,
  resolveStoredWompiSecret,
} from "@/modules/billing/services/wompi-persistence";

export type WompiCredentialSource = "environment" | "database" | "both" | "none";

export type WompiCredentialStatus =
  | "missing"
  | "stored"
  | "environment"
  | "both";

export type WompiCredentialSnapshot = {
  configured: boolean;
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

function mergeWompiConfig(
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

/** Server-only: DB-stored credentials win over env per field. */
export async function resolveWompiConfig(): Promise<WompiConfig> {
  const envConfig = getWompiConfigFromEnv();
  const row = await getWompiIntegrationSafe();

  if (!row) return envConfig;

  return mergeWompiConfig(
    {
      publicKey: row.publicKey,
      privateKey: resolveStoredWompiSecret(row.privateKeyEncrypted),
      eventsSecret: resolveStoredWompiSecret(row.eventsSecretEncrypted),
      integritySecret: resolveStoredWompiSecret(row.integritySecretEncrypted),
      env: resolveEnv(row.env),
    },
    envConfig,
  );
}

export async function getWompiCredentialSnapshot(): Promise<WompiCredentialSnapshot> {
  const envConfig = getWompiConfigFromEnv();
  const row = await getWompiIntegrationSafe();
  const resolved = await resolveWompiConfig();

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

  return {
    configured: resolved.configured,
    webhookReady: Boolean(resolved.eventsSecret),
    source,
    status,
    hasStoredCredentials,
    hasEnvCredentials,
    env: resolved.env,
    publicKey: resolved.publicKey,
    publicKeyHint: buildPublicKeyHint(resolved.publicKey),
    privateKeyHint: buildSecretHint(resolved.privateKey),
    eventsSecretHint: buildSecretHint(resolved.eventsSecret),
    integritySecretHint: buildSecretHint(resolved.integritySecret),
    schemaReady: hasWompiIntegrationDelegate(),
    webhookPath: "/api/payments/wompi/webhook",
  };
}

export async function isWompiConfiguredAsync(): Promise<boolean> {
  const config = await resolveWompiConfig();
  return config.configured;
}
