import { TTLockIntegrationStatus } from "@prisma/client";

export type TTLockTokenHealth =
  | "active"
  | "expired"
  | "missing"
  | "invalid"
  | "revoked";

export type TTLockOverviewMetrics = {
  integrationStatus: TTLockIntegrationStatus;
  integrationStatusLabel: string;
  tokenHealth: TTLockTokenHealth;
  tokenHealthLabel: string;
  lockSyncLabel: string;
  mappingLabel: string;
  automationReadiness: "ready" | "manual" | "disabled";
  automationReadinessLabel: string;
  hasCredentials: boolean;
  hasTokens: boolean;
  mappedCount: number;
  propertyCount: number;
};

const integrationStatusLabels: Record<TTLockIntegrationStatus, string> = {
  NOT_CONNECTED: "No conectado",
  CONNECTING: "Conectando",
  PENDING_SETUP: "Configuración pendiente",
  CONNECTED: "Conectado",
  INVALID_CREDENTIALS: "Credenciales inválidas",
  TOKEN_EXPIRED: "Token expirado",
  SYNC_ERROR: "Error de sincronización",
  READY: "Listo",
};

const tokenHealthLabels: Record<TTLockTokenHealth, string> = {
  active: "Activo",
  expired: "Expirado",
  missing: "Pendiente",
  invalid: "Inválido",
  revoked: "Revocado",
};

export function deriveTokenHealth(input: {
  status: TTLockIntegrationStatus;
  hasAccessToken: boolean;
  expiresAt: Date | string | null;
}): TTLockTokenHealth {
  if (input.status === TTLockIntegrationStatus.NOT_CONNECTED) return "missing";
  if (input.status === TTLockIntegrationStatus.INVALID_CREDENTIALS) return "invalid";
  if (input.status === TTLockIntegrationStatus.TOKEN_EXPIRED) return "expired";
  if (!input.hasAccessToken) return "missing";

  if (input.expiresAt) {
    const expiresAt = new Date(input.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return "expired";
    }
  }

  return "active";
}

export function deriveOverviewMetrics(input: {
  status: TTLockIntegrationStatus;
  hasCredentials: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expiresAt: Date | string | null;
  lastSyncedAt: Date | string | null;
  mappedCount: number;
  propertyCount: number;
  generateAfterGuestRegistration: boolean;
  callbackValid?: boolean;
}): TTLockOverviewMetrics {
  const tokenHealth = deriveTokenHealth({
    status: input.status,
    hasAccessToken: input.hasAccessToken,
    expiresAt: input.expiresAt,
  });

  const mappingLabel =
    input.propertyCount === 0
      ? "Sin propiedades activas"
      : `${input.mappedCount}/${input.propertyCount} mapeadas`;

  const lockSyncLabel = input.lastSyncedAt
    ? `${input.mappedCount} lock(s) sincronizados`
    : input.hasAccessToken
      ? "Sync pendiente"
      : "Sin sync";

  let automationReadiness: TTLockOverviewMetrics["automationReadiness"] = "disabled";
  if (input.generateAfterGuestRegistration && input.mappedCount > 0 && input.hasAccessToken) {
    automationReadiness = "ready";
  } else if (input.generateAfterGuestRegistration) {
    automationReadiness = "manual";
  }

  const statusLabel =
    input.callbackValid === false &&
    input.status !== TTLockIntegrationStatus.CONNECTED &&
    input.status !== TTLockIntegrationStatus.READY
      ? "Callback inválido"
      : integrationStatusLabels[input.status];

  return {
    integrationStatus: input.status,
    integrationStatusLabel: statusLabel,
    tokenHealth,
    tokenHealthLabel: tokenHealthLabels[tokenHealth],
    lockSyncLabel,
    mappingLabel,
    automationReadiness,
    automationReadinessLabel:
      automationReadiness === "ready"
        ? "Lista"
        : automationReadiness === "manual"
          ? "Configuración manual"
          : "Desactivada",
    hasCredentials: input.hasCredentials,
    hasTokens: input.hasAccessToken && input.hasRefreshToken,
    mappedCount: input.mappedCount,
    propertyCount: input.propertyCount,
  };
}
