import "server-only";

import type { EpaycoEnvironment } from "@/modules/integrations/epayco/epayco.config";
import {
  getEpaycoIntegrationForOrganization,
  resolveStoredEpaycoSecret,
} from "@/modules/integrations/epayco/epayco-persistence";
import {
  resolvePlatformEpaycoOrganizationId,
} from "@/modules/billing/services/epayco-platform.service";

export type EpaycoRuntimeConfig = {
  publicKey: string;
  privateKey: string;
  pKey: string;
  custIdCliente: string;
  env: EpaycoEnvironment;
  test: boolean;
};

export type EpaycoCredentialSnapshot = {
  configured: boolean;
  enabled: boolean;
  preferForGuestPayments: boolean;
  preferForSubscriptionPayments: boolean;
  env: EpaycoEnvironment;
  publicKeyHint: string | null;
  custIdClienteHint: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  webhookPath: string;
  webhookUrl: string | null;
};

function maskKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function resolvePublicWebhookUrl(): string | null {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!baseUrl) return null;

  const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  return `${origin.replace(/\/$/, "")}/api/webhooks/epayco`;
}

/** Platform-wide ePayco credentials for SaaS subscription checkout. */
export async function resolvePlatformEpaycoConfig(): Promise<Partial<EpaycoRuntimeConfig>> {
  const organizationId = await resolvePlatformEpaycoOrganizationId();
  if (!organizationId) return {};
  return resolveEpaycoConfig(organizationId);
}

export async function isPlatformEpaycoConfigured(): Promise<boolean> {
  const organizationId = await resolvePlatformEpaycoOrganizationId();
  if (!organizationId) return false;
  return isEpaycoConfiguredForOrganization(organizationId);
}

export async function getPlatformEpaycoCredentialSnapshot(): Promise<EpaycoCredentialSnapshot> {
  const organizationId = await resolvePlatformEpaycoOrganizationId();
  if (!organizationId) {
    return {
      configured: false,
      enabled: false,
      preferForGuestPayments: false,
      preferForSubscriptionPayments: false,
      env: "test",
      publicKeyHint: null,
      custIdClienteHint: null,
      lastHealthCheckAt: null,
      lastError: null,
      webhookPath: "/api/webhooks/epayco",
      webhookUrl: resolvePublicWebhookUrl(),
    };
  }
  return getEpaycoCredentialSnapshot(organizationId);
}

export async function isEpaycoConfiguredForOrganization(
  organizationId: string,
): Promise<boolean> {
  const row = await getEpaycoIntegrationForOrganization(organizationId);
  if (!row?.enabled) return false;
  if (!row.publicKey?.trim()) return false;
  if (!row.privateKeyEncrypted || !row.pKeyEncrypted) return false;
  return true;
}

export async function resolveEpaycoConfig(
  organizationId: string,
): Promise<Partial<EpaycoRuntimeConfig>> {
  const row = await getEpaycoIntegrationForOrganization(organizationId);
  if (!row) return {};

  const env = (row.env === "production" ? "production" : "test") as EpaycoEnvironment;

  return {
    publicKey: row.publicKey?.trim() ?? "",
    privateKey: resolveStoredEpaycoSecret(row.privateKeyEncrypted) ?? "",
    pKey: resolveStoredEpaycoSecret(row.pKeyEncrypted) ?? "",
    custIdCliente: row.custIdCliente?.trim() ?? "",
    env,
    test: env !== "production",
  };
}

export async function getEpaycoCredentialSnapshot(
  organizationId: string,
): Promise<EpaycoCredentialSnapshot> {
  const row = await getEpaycoIntegrationForOrganization(organizationId);
  if (!row) {
    return {
      configured: false,
      enabled: false,
      preferForGuestPayments: false,
      preferForSubscriptionPayments: false,
      env: "test",
      publicKeyHint: null,
      custIdClienteHint: null,
      lastHealthCheckAt: null,
      lastError: null,
      webhookPath: "/api/webhooks/epayco",
      webhookUrl: resolvePublicWebhookUrl(),
    };
  }

  const configured = await isEpaycoConfiguredForOrganization(organizationId);

  return {
    configured,
    enabled: row.enabled,
    preferForGuestPayments: row.preferForGuestPayments,
    preferForSubscriptionPayments: row.preferForSubscriptionPayments,
    env: row.env === "production" ? "production" : "test",
    publicKeyHint: maskKey(row.publicKey),
    custIdClienteHint: maskKey(row.custIdCliente),
    lastHealthCheckAt: row.lastHealthCheckAt?.toISOString() ?? null,
    lastError: row.lastError,
    webhookPath: "/api/webhooks/epayco",
    webhookUrl: resolvePublicWebhookUrl(),
  };
}
