import type {
  AccessCredentialStatus,
  AccessCodeType,
  TTLockIntegrationStatus,
  TTLockLockStatus,
  TTLockOnlineState,
} from "@prisma/client";

export type TTLockIntegrationSnapshot = {
  id: string;
  organizationId: string | null;
  userId: string;
  status: TTLockIntegrationStatus;
  isActive: boolean;
  gatewayId: string | null;
  configured: boolean;
  connected: boolean;
};

export type SmartLockSnapshot = {
  id: string;
  propertyId: string;
  propertyName: string;
  ttlockLockId: string | null;
  alias: string | null;
  gatewayId: string | null;
  batteryLevel: number | null;
  lockStatus: TTLockLockStatus;
  onlineState: TTLockOnlineState;
  lastSyncAt: string | null;
};

export type AccessCodeSnapshot = {
  id: string;
  reservationId: string;
  type: AccessCodeType;
  status: AccessCredentialStatus;
  codeHint: string | null;
  validFrom: string | null;
  validTo: string | null;
  ttlockCodeId: string | null;
};

export type TTLockApiSession = {
  integrationId: string;
  organizationId: string | null;
  clientId: string;
  accessToken: string;
  environment: "PRODUCTION" | "SANDBOX";
};

export type TTLockWebhookPayload = {
  lockId?: string | number;
  event?: string;
  keyboardPwdId?: number;
  electricQuantity?: number;
  [key: string]: unknown;
};
