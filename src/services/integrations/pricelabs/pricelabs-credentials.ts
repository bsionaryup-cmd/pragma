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
  const stored = resolveStoredSecret(row?.integrationTokenEncrypted);
  const env = getPriceLabsApiKeyFromEnv();
  const hasStoredKey = Boolean(stored);
  const hasEnvKey = Boolean(env);

  let source: PriceLabsCredentialSource = "none";
  let status: PriceLabsCredentialStatus = "missing";

  if (hasStoredKey && hasEnvKey) {
    source = "both";
    status = "both";
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
    keyHint: activeKey ? buildKeyHint(activeKey) : null,
  };
}

export async function isPriceLabsConfiguredAsync(): Promise<boolean> {
  const snapshot = await getPriceLabsCredentialSnapshot();
  return snapshot.configured;
}
