import type {
  AccessCredential,
  PropertyLock,
  TTLockIntegration,
} from "@prisma/client";
import { isPlatformTTLockConfigured } from "@/lib/integrations/ttlock-platform";
import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";
import type {
  AccessCodeSnapshot,
  SmartLockSnapshot,
  TTLockIntegrationSnapshot,
} from "@/modules/integrations/ttlock/ttlock.types";
import { isTTLockIntegrationConnected } from "@/modules/integrations/ttlock/ttlock.persistence";

export function mapTTLockIntegrationSnapshot(
  integration: TTLockIntegration & {
    clientId?: string | null;
    clientSecretEncrypted?: string | null;
  },
): TTLockIntegrationSnapshot {
  const configured =
    isPlatformTTLockConfigured() ||
    Boolean(integration.clientId?.trim() && integration.clientSecretEncrypted);
  return {
    id: integration.id,
    organizationId: integration.organizationId,
    userId: integration.userId,
    status: integration.status,
    isActive: integration.isActive,
    gatewayId: integration.gatewayId,
    configured,
    connected: isTTLockIntegrationConnected(integration),
  };
}

export function mapSmartLockSnapshot(input: {
  lock: PropertyLock;
  propertyName: string;
}): SmartLockSnapshot {
  return {
    id: input.lock.id,
    propertyId: input.lock.propertyId,
    propertyName: input.propertyName,
    ttlockLockId: input.lock.ttlockLockId,
    alias: input.lock.alias,
    gatewayId: input.lock.gatewayId,
    batteryLevel: input.lock.batteryLevel,
    lockStatus: input.lock.lockStatus,
    onlineState: input.lock.onlineState,
    lastSyncAt: input.lock.lastSyncAt?.toISOString() ?? null,
  };
}

export function mapAccessCodeSnapshot(
  credential: AccessCredential,
  options?: { revealCode?: boolean },
): AccessCodeSnapshot {
  const code = options?.revealCode
    ? decryptTTLockSecret(credential.codeEncrypted)
    : null;
  const hint =
    code && code.length >= 2 ? `••••${code.slice(-2)}` : null;

  return {
    id: credential.id,
    reservationId: credential.reservationId,
    type: credential.type,
    status: credential.status,
    codeHint: code ?? hint,
    validFrom: credential.validFrom?.toISOString() ?? null,
    validTo: credential.validTo?.toISOString() ?? null,
    ttlockCodeId: credential.ttlockCodeId,
  };
}

export function maskAccessCode(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code.length <= 2) return "••";
  return `••••${code.slice(-2)}`;
}
