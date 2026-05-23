import { OrganizationIntegrationProvider } from "@prisma/client";
import { getPriceLabsApiKeyFromEnv } from "@/lib/integrations/pricelabs-config";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  getOrganizationIntegration,
  resolveStoredIntegrationSecret,
} from "@/services/integrations/organization-integration.service";
import { getPriceLabsOrganizationId } from "@/services/integrations/pricelabs/pricelabs-org-context";

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
  decryptFailed: boolean;
  keyHint: string | null;
};

function buildKeyHint(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length < 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

async function resolveOrganizationId(): Promise<string> {
  const fromContext = getPriceLabsOrganizationId();
  if (fromContext) return fromContext;
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    throw new Error("Organización no disponible");
  }
  return scope.organizationId;
}

/** Server-only: org-stored key wins over env (dev fallback only). */
export async function resolvePriceLabsApiKey(): Promise<string | null> {
  const organizationId = await resolveOrganizationId();
  const row = await getOrganizationIntegration(
    organizationId,
    OrganizationIntegrationProvider.PRICELABS,
  );
  const stored = resolveStoredIntegrationSecret(row?.apiKeyEncrypted);
  if (stored) return stored;

  if (process.env.NODE_ENV === "production") return null;
  return getPriceLabsApiKeyFromEnv();
}

export async function getPriceLabsCredentialSnapshot(
  organizationId?: string,
): Promise<PriceLabsCredentialSnapshot> {
  const orgId = organizationId ?? (await resolveOrganizationId());
  const row = await getOrganizationIntegration(
    orgId,
    OrganizationIntegrationProvider.PRICELABS,
  );
  const encrypted = row?.apiKeyEncrypted;
  const hasStoredKey = Boolean(encrypted?.trim());
  const stored = resolveStoredIntegrationSecret(encrypted);
  const env =
    process.env.NODE_ENV === "production" ? null : getPriceLabsApiKeyFromEnv();
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

export async function isPriceLabsConfiguredAsync(
  organizationId?: string,
): Promise<boolean> {
  const snapshot = await getPriceLabsCredentialSnapshot(organizationId);
  return snapshot.configured;
}
