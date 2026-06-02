import "server-only";

import type { EpaycoEnvironment } from "@/modules/integrations/epayco/epayco.config";
import {
  getEpaycoIntegrationForOrganization,
  resolveStoredEpaycoSecret,
} from "@/modules/integrations/epayco/epayco-persistence";

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
  env: EpaycoEnvironment;
  publicKeyHint: string | null;
  custIdClienteHint: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
};

function maskKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
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
      env: "test",
      publicKeyHint: null,
      custIdClienteHint: null,
      lastHealthCheckAt: null,
      lastError: null,
    };
  }

  const configured = await isEpaycoConfiguredForOrganization(organizationId);

  return {
    configured,
    enabled: row.enabled,
    preferForGuestPayments: row.preferForGuestPayments,
    env: row.env === "production" ? "production" : "test",
    publicKeyHint: maskKey(row.publicKey),
    custIdClienteHint: maskKey(row.custIdCliente),
    lastHealthCheckAt: row.lastHealthCheckAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}
