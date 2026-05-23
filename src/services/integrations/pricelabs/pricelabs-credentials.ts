import { getPriceLabsApiKeyFromEnv } from "@/lib/integrations/pricelabs-config";
import {
  getPriceLabsIntegrationSafe,
  resolveStoredSecret,
} from "@/services/integrations/pricelabs/pricelabs-persistence";

export type PriceLabsCredentialSource = "environment" | "database" | "both" | "none";

export type PriceLabsCredentialStatus =
  | "missing"
  | "stored"
  | "environment"
  | "both";

export type PriceLabsCredentialSnapshot = {
  configured: boolean;
  source: PriceLabsCredentialSource;
  status: PriceLabsCredentialStatus;
  hasStoredKey: boolean;
  hasEnvKey: boolean;
  /** Ciphertext exists but current server keys cannot decrypt it */
  decryptFailed: boolean;
  /** Last 4 chars only — safe for UI */
  keyHint: string | null;
};

function buildKeyHint(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length < 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

/** Server-only: DB-stored key wins over env. */
export async function resolvePriceLabsApiKey(): Promise<string | null> {
  const row = await getPriceLabsIntegrationSafe();
  const stored = resolveStoredSecret(row?.integrationTokenEncrypted);
  if (stored) return stored;
  return getPriceLabsApiKeyFromEnv();
}

export async function getPriceLabsCredentialSnapshot(): Promise<PriceLabsCredentialSnapshot> {
  const row = await getPriceLabsIntegrationSafe();
  const encrypted = row?.integrationTokenEncrypted;
  const hasStoredKey = Boolean(encrypted?.trim());
  const stored = resolveStoredSecret(encrypted);
  const env = getPriceLabsApiKeyFromEnv();
  const decryptFailed =
    hasStoredKey && stored === null && encrypted!.startsWith("enc:v1:");
  const hasEnvKey = Boolean(env);

  let source: PriceLabsCredentialSource = "none";
  let status: PriceLabsCredentialStatus = "missing";

  if (stored && hasEnvKey) {
    source = "both";
    status = "both";
  } else if (stored) {
    source = "database";
    status = "stored";
  } else if (hasStoredKey) {
    source = "database";
    status = "stored";
  } else if (hasEnvKey) {
    source = "environment";
    status = "environment";
  }

  const activeKey = stored ?? env;

  return {
    configured: Boolean(activeKey),
    source,
    status,
    hasStoredKey,
    hasEnvKey,
    decryptFailed,
    keyHint: activeKey ? buildKeyHint(activeKey) : null,
  };
}

export async function isPriceLabsConfiguredAsync(): Promise<boolean> {
  const snapshot = await getPriceLabsCredentialSnapshot();
  return snapshot.configured;
}
