/**
 * Pure status derivation for unified integration health.
 * No DB, no server-only, no I/O — covered by tests/integrations/integration-health.test.ts.
 */
import type {
  IntegrationHealthReport,
  IntegrationHealthStatus,
} from "./types";

/** A success newer than this counts as "recent". */
export const RECENT_SUCCESS_MS = 24 * 60 * 60 * 1000;
/** A CONNECTED integration whose last success is older than this is considered stale. */
export const STALE_SUCCESS_MS = 72 * 60 * 60 * 1000;

type DateLike = string | Date | null | undefined;

function toMs(value: DateLike): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function latestIso(...values: DateLike[]): string | null {
  let best: number | null = null;
  for (const value of values) {
    const ms = toMs(value);
    if (ms != null && (best == null || ms > best)) best = ms;
  }
  return best == null ? null : new Date(best).toISOString();
}

export function isRecentSuccess(
  lastSuccessAt: DateLike,
  now: Date = new Date(),
  windowMs: number = RECENT_SUCCESS_MS,
): boolean {
  const ms = toMs(lastSuccessAt);
  return ms != null && now.getTime() - ms <= windowMs;
}

function isStaleSuccess(lastSuccessAt: DateLike, now: Date): boolean {
  const ms = toMs(lastSuccessAt);
  return ms != null && now.getTime() - ms > STALE_SUCCESS_MS;
}

/** Statuses that are not worth replaying an automatic recovery for. */
export function isHealthy(status: IntegrationHealthStatus): boolean {
  return status === "CONNECTED";
}

// ─── PriceLabs ────────────────────────────────────────────────

/** Structural subset of PriceLabsOverviewDto — the DTO is passed as-is. */
export type PriceLabsHealthInput = {
  integration: {
    status: string;
    lastError: string | null;
    lastHealthCheckAt: string | null;
    lastListingsSyncAt: string | null;
    lastPricesSyncAt: string | null;
  };
  config: { liveApiEnabled: boolean; configured: boolean };
  credentials?: { decryptFailed?: boolean };
  database?: { setupRequired?: boolean; hint?: string | null };
  syncing: boolean;
  properties: Array<{ syncStatus: string; lastError?: string | null }>;
};

export function mapPriceLabsOverviewToHealth(
  overview: PriceLabsHealthInput,
  now: Date = new Date(),
): IntegrationHealthReport {
  const { integration, config } = overview;
  const status = integration.status;
  const lastError = integration.lastError ?? null;

  const healthCheckIsSuccess =
    !lastError && (status === "CONNECTED" || status === "SYNC_REQUIRED");
  const lastSuccessAt = latestIso(
    integration.lastListingsSyncAt,
    integration.lastPricesSyncAt,
    healthCheckIsSuccess ? integration.lastHealthCheckAt : null,
  );

  const listingErrors = overview.properties.filter(
    (p) => p.syncStatus === "ERROR",
  );
  const evidence: string[] = [`Estado organización: ${status}`];
  if (listingErrors.length > 0) {
    evidence.push(`${listingErrors.length} listing(s) con error de sync`);
  }
  if (lastSuccessAt) evidence.push(`Último sync correcto: ${lastSuccessAt}`);
  if (lastError) evidence.push(`Error: ${lastError}`);

  const base = {
    id: "pricelabs",
    provider: "PRICELABS" as const,
    lastSuccessAt,
    lastError,
  };
  const report = (
    s: IntegrationHealthStatus,
    canRecover: boolean,
    extra?: string,
  ): IntegrationHealthReport => ({
    ...base,
    status: s,
    canRecover,
    evidence: extra ? [extra, ...evidence] : evidence,
  });

  if (overview.syncing) return report("VERIFYING", false, "Sincronización en curso");

  if (overview.database?.setupRequired) {
    return report(
      "NEEDS_ATTENTION",
      false,
      overview.database.hint ?? "Migración de base de datos pendiente",
    );
  }

  if (!config.configured || status === "NOT_CONNECTED") {
    return report("DISCONNECTED", false, "API key PriceLabs no configurada");
  }

  if (overview.credentials?.decryptFailed) {
    return report("NEEDS_ATTENTION", false, "No se pudo descifrar la API key guardada");
  }

  if (status === "INVALID_KEY") {
    return report("NEEDS_ATTENTION", false, "API key inválida — pega una nueva");
  }

  if (!config.liveApiEnabled) {
    return report(
      "NEEDS_ATTENTION",
      false,
      "API en modo simulación (PRICELABS_API_ENABLED desactivado)",
    );
  }

  if (listingErrors.length > 0 || status === "DEGRADED") {
    return report("DEGRADED", true);
  }

  if (status === "SYNC_FAILED") {
    return report(lastSuccessAt ? "DEGRADED" : "NEEDS_ATTENTION", true);
  }

  if (status === "CONNECTED") {
    if (!lastSuccessAt) return report("VERIFYING", true, "Sin sync registrado todavía");
    if (isStaleSuccess(lastSuccessAt, now)) {
      return report("DEGRADED", true, "Último sync correcto hace más de 72 h");
    }
    return report("CONNECTED", false);
  }

  // SYNC_REQUIRED (configured, live, no listing errors)
  if (!lastError && isRecentSuccess(lastSuccessAt, now)) {
    return report("CONNECTED", false);
  }
  return report("VERIFYING", true);
}

// ─── TTLock ───────────────────────────────────────────────────

export type TTLockHealthInput = {
  status: string;
  platformConfigured: boolean;
  accountConnected: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expiresAt: string | null;
  lastSyncedAt: string | null;
  lastTokenRefreshAt?: string | null;
  lastError: string | null;
};

export function mapTTLockToHealth(
  input: TTLockHealthInput,
  now: Date = new Date(),
): IntegrationHealthReport {
  const lastError = input.lastError ?? null;
  const expiresMs = toMs(input.expiresAt);
  const tokenExpired = expiresMs != null && expiresMs <= now.getTime();
  const lastSuccessAt = latestIso(input.lastSyncedAt, input.lastTokenRefreshAt);
  const evidence = [
    `Estado TTLock: ${input.status}`,
    input.hasAccessToken ? "Token de acceso presente" : "Sin token de acceso",
  ];
  if (tokenExpired) evidence.push("Token expirado");
  if (lastSuccessAt) evidence.push(`Última actividad correcta: ${lastSuccessAt}`);
  if (lastError) evidence.push(`Error: ${lastError}`);

  const report = (
    status: IntegrationHealthStatus,
    canRecover: boolean,
  ): IntegrationHealthReport => ({
    id: "ttlock",
    provider: "TTLOCK",
    status,
    evidence,
    lastSuccessAt,
    lastError,
    canRecover,
  });

  if (!input.platformConfigured) return report("NEEDS_ATTENTION", false);
  if (input.status === "INVALID_CREDENTIALS") return report("NEEDS_ATTENTION", false);
  if (input.status === "NOT_CONNECTED" || (!input.hasAccessToken && !input.hasRefreshToken)) {
    return report(
      input.status === "CONNECTING" || input.status === "PENDING_SETUP"
        ? "VERIFYING"
        : "DISCONNECTED",
      false,
    );
  }
  if (input.status === "CONNECTING" || input.status === "PENDING_SETUP") {
    return report("VERIFYING", true);
  }
  if (input.status === "TOKEN_EXPIRED" || tokenExpired) {
    return report(input.hasRefreshToken ? "DEGRADED" : "NEEDS_ATTENTION", input.hasRefreshToken);
  }
  if (input.status === "SYNC_ERROR") return report("DEGRADED", true);
  if (!input.lastSyncedAt) return report("VERIFYING", true);
  return report("CONNECTED", false);
}

// ─── Airbnb iCal ──────────────────────────────────────────────

export type AirbnbIcalHealthInput = {
  linkedCount: number;
  lastSyncedAt: string | null;
  properties: Array<{ lastSyncedAt: string | null }>;
};

export function mapAirbnbIcalToHealth(
  input: AirbnbIcalHealthInput,
  now: Date = new Date(),
): IntegrationHealthReport {
  const lastSuccessAt = latestIso(input.lastSyncedAt);
  const base = { id: "airbnb-ical", provider: "AIRBNB_ICAL" as const, lastError: null };

  if (input.linkedCount === 0) {
    return {
      ...base,
      status: "DISCONNECTED",
      evidence: ["Ninguna propiedad con iCal de Airbnb conectado"],
      lastSuccessAt,
      canRecover: false,
    };
  }

  const stale = input.properties.filter(
    (p) => !isRecentSuccess(p.lastSyncedAt, now),
  ).length;
  const evidence = [
    `${input.linkedCount} propiedad(es) con iCal`,
    `${input.linkedCount - stale} sincronizada(s) en las últimas 24 h`,
  ];
  if (lastSuccessAt) evidence.push(`Último sync: ${lastSuccessAt}`);

  let status: IntegrationHealthStatus;
  if (stale === 0) status = "CONNECTED";
  else if (!lastSuccessAt) status = "VERIFYING";
  else if (stale === input.linkedCount) status = "NEEDS_ATTENTION";
  else status = "DEGRADED";
  if (stale > 0) evidence.push(`${stale} propiedad(es) sin sync reciente`);

  return {
    ...base,
    status,
    evidence,
    lastSuccessAt,
    canRecover: status !== "CONNECTED",
  };
}

// ─── SIRE / TRAA (ExternalIntegration) ────────────────────────

export type ExternalIntegrationHealthInput = {
  provider: "SIRE" | "TRAA";
  status: string; // NOT_CONNECTED | PENDING_SETUP | CONNECTED | ERROR
  lastError: string | null;
  lastTestedAt: string | null;
  hasCredentials: boolean;
};

export function mapExternalIntegrationToHealth(
  input: ExternalIntegrationHealthInput,
): IntegrationHealthReport {
  const lastError = input.lastError ?? null;
  const lastSuccessAt = input.status === "CONNECTED" ? latestIso(input.lastTestedAt) : null;
  const evidence = [`Estado ${input.provider}: ${input.status}`];
  if (input.lastTestedAt) evidence.push(`Última prueba: ${input.lastTestedAt}`);
  if (lastError) evidence.push(`Error: ${lastError}`);

  let status: IntegrationHealthStatus;
  let canRecover: boolean;
  switch (input.status) {
    case "CONNECTED":
      status = "CONNECTED";
      canRecover = false;
      break;
    case "ERROR":
      status = "NEEDS_ATTENTION";
      canRecover = input.hasCredentials;
      break;
    case "PENDING_SETUP":
      status = "VERIFYING";
      canRecover = input.hasCredentials;
      break;
    default:
      status = "DISCONNECTED";
      canRecover = false;
  }

  return {
    id: input.provider.toLowerCase(),
    provider: input.provider,
    status,
    evidence,
    lastSuccessAt,
    lastError,
    canRecover,
  };
}
