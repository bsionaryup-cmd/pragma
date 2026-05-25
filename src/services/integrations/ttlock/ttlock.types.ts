import type {
  TTLockEnvironment,
  TTLockExpirationStrategy,
  TTLockIntegrationStatus,
  TTLockLockStatus,
  TTLockOnlineState,
} from "@prisma/client";
import type { TTLockCallbackValidation } from "@/lib/integrations/ttlock-url";
import type { TTLockOverviewMetrics } from "@/services/integrations/ttlock/ttlock-status";
import type { TTLockRemoteLock } from "@/services/integrations/ttlock/ttlock-api.client";

export type TTLockOverviewDto = {
  integration: {
    id: string;
    status: TTLockIntegrationStatus;
    environment: TTLockEnvironment;
    uid: string | null;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt: string | null;
    lastSyncedAt: string | null;
    lastTokenRefreshAt: string | null;
    lastError: string | null;
    accountConnected: boolean;
    platformConfigured: boolean;
    syncedLockCount: number;
    automationSettings: {
      generateAfterGuestRegistration: boolean;
      revokeAfterCheckout: boolean;
      requireManualApproval: boolean;
      autoSendCode: boolean;
      allowRegeneration: boolean;
      expirationStrategy: TTLockExpirationStrategy;
    } | null;
  };
  callbackUrl: string;
  callbackSource: string;
  callbackValidation: TTLockCallbackValidation;
  canManage: boolean;
  remoteLocks: TTLockRemoteLock[];
  properties: Array<{
    id: string;
    name: string;
    unitNumber: string | null;
    address: string;
    city: string;
  }>;
  propertyLocks: Array<{
    id: string;
    propertyId: string;
    ttlockLockId: string | null;
    alias: string | null;
    timezone: string | null;
    lockStatus: TTLockLockStatus;
    onlineState: TTLockOnlineState;
    property: {
      id: string;
      name: string;
      address: string;
      city: string;
    };
  }>;
  accessCredentialCount: number;
  eventCount: number;
  metrics: TTLockOverviewMetrics;
  liveApiEnabled: boolean;
};

export type TTLockConnectionTestResult = {
  ok: boolean;
  message: string;
  checkedAt: string;
  callbackValid?: boolean;
  steps?: string[];
};

export type TTLockStatusPayload = {
  status: TTLockIntegrationStatus;
  statusLabel: string;
  hasCredentials: boolean;
  hasTokens: boolean;
  tokenHealth: string;
  lastError: string | null;
  uid: string | null;
  expiresAt: string | null;
};
