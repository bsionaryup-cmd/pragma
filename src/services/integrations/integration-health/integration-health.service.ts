import "server-only";

import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { getExternalIntegration, testExternalIntegration } from "@/services/integrations/external-integration.service";
import { handleAirbnbSyncAll, handleAirbnbSyncStatus } from "@/services/airbnb/airbnb-auto-sync.handlers";
import { runPriceLabsSyncPipeline } from "@/services/integrations/pricelabs/pricelabs-orchestrator";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";
import {
  getTTLockOverview,
  refreshTTLockToken,
  syncTTLockLocks,
  testTTLockConnection,
} from "@/services/integrations/ttlock.service";
import {
  mapAirbnbIcalToHealth,
  mapExternalIntegrationToHealth,
  mapPriceLabsOverviewToHealth,
  mapTTLockToHealth,
} from "./derive-health";
import {
  INTEGRATION_HEALTH_PROVIDERS,
  type IntegrationHealthProvider,
  type IntegrationHealthReport,
  type IntegrationHealthScope,
  type IntegrationRecoveryResult,
} from "./types";

export type GetAllIntegrationHealthOptions = {
  /** Restrict to these providers (e.g. plan-enabled ones). Default: all. */
  providers?: readonly IntegrationHealthProvider[];
  /** Forwarded to PriceLabs/TTLock overview loaders. */
  canManage?: boolean;
  now?: Date;
};

function failedReport(
  provider: IntegrationHealthProvider,
  error: unknown,
): IntegrationHealthReport {
  const message = error instanceof Error ? error.message : "Error desconocido";
  return {
    id: provider.toLowerCase(),
    provider,
    status: "NEEDS_ATTENTION",
    evidence: [`No se pudo leer el estado: ${message}`],
    lastSuccessAt: null,
    lastError: message,
    canRecover: false,
  };
}

async function collect(
  provider: IntegrationHealthProvider,
  scope: IntegrationHealthScope,
  options: GetAllIntegrationHealthOptions,
): Promise<IntegrationHealthReport | null> {
  const now = options.now ?? new Date();
  try {
    switch (provider) {
      case "PRICELABS": {
        if (!scope.organizationId) return null;
        const overview = await getPriceLabsOverview(options.canManage ?? false);
        return mapPriceLabsOverviewToHealth(overview, now);
      }
      case "TTLOCK": {
        const overview = await getTTLockOverview(scope.userId, {
          canManage: options.canManage ?? false,
        });
        const i = overview.integration;
        return mapTTLockToHealth(
          {
            status: i.status,
            platformConfigured: i.platformConfigured,
            accountConnected: i.accountConnected,
            hasAccessToken: i.hasAccessToken,
            hasRefreshToken: i.hasRefreshToken,
            expiresAt: i.expiresAt,
            lastSyncedAt: i.lastSyncedAt,
            lastTokenRefreshAt: i.lastTokenRefreshAt,
            lastError: i.lastError,
          },
          now,
        );
      }
      case "AIRBNB_ICAL": {
        const { status } = await handleAirbnbSyncStatus(scope.userId);
        return mapAirbnbIcalToHealth(status, now);
      }
      case "SIRE":
      case "TRAA": {
        const row = await getExternalIntegration(provider, scope.organizationId);
        if (!row) return null; // "if present"
        return mapExternalIntegrationToHealth({
          provider,
          status: row.status,
          lastError: row.lastError,
          lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
          hasCredentials: Boolean(
            row.apiKeyEncrypted || row.tokenEncrypted || row.clientSecretEncrypted,
          ),
        });
      }
    }
  } catch (error) {
    return failedReport(provider, error);
  }
}

/**
 * Aggregates PriceLabs (org + listings), TTLock, Airbnb iCal and
 * SIRE/TRAA (ExternalIntegration, only when a row exists). Read-only.
 */
export async function getAllIntegrationHealth(
  scope: IntegrationHealthScope,
  options: GetAllIntegrationHealthOptions = {},
): Promise<IntegrationHealthReport[]> {
  const providers = options.providers ?? INTEGRATION_HEALTH_PROVIDERS;
  const reports = await Promise.all(
    providers.map((provider) => collect(provider, scope, options)),
  );
  return reports.filter((r): r is IntegrationHealthReport => r !== null);
}

// ─── Recovery ─────────────────────────────────────────────────

/** Minimum gap between recovery attempts for the same scope+provider. */
const RECOVERY_COOLDOWN_MS = 60_000;
const inFlight = new Map<string, Promise<IntegrationRecoveryResult>>();
const lastAttemptAt = new Map<string, number>();

function recoveryKey(provider: IntegrationHealthProvider, scope: IntegrationHealthScope) {
  return `${scope.organizationId ?? `user:${scope.userId}`}:${provider}`;
}

function result(
  provider: IntegrationHealthProvider,
  partial: Omit<IntegrationRecoveryResult, "provider" | "actions"> & { actions?: string[] },
): IntegrationRecoveryResult {
  return { provider, actions: [], ...partial };
}

async function runRecovery(
  provider: IntegrationHealthProvider,
  scope: IntegrationHealthScope,
  report: IntegrationHealthReport,
): Promise<IntegrationRecoveryResult> {
  const actions: string[] = [];
  try {
    switch (provider) {
      case "PRICELABS": {
        // Pipeline already holds the per-org sync lock and tests the connection first.
        actions.push("runPriceLabsSyncPipeline(full)");
        const r = await runPriceLabsSyncPipeline({ source: "manual", mode: "full" });
        return result(provider, { ok: r.ok, skipped: false, message: r.message, actions });
      }
      case "TTLOCK": {
        const overview = await getTTLockOverview(scope.userId);
        const i = overview.integration;
        const expired =
          i.status === "TOKEN_EXPIRED" ||
          (i.expiresAt != null && new Date(i.expiresAt).getTime() <= Date.now());
        if (expired) {
          actions.push("refreshTTLockToken");
          await refreshTTLockToken(scope.userId);
        }
        if (expired || i.status === "SYNC_ERROR" || !i.lastSyncedAt) {
          actions.push("syncTTLockLocks");
          await syncTTLockLocks(scope.userId);
        } else {
          actions.push("testTTLockConnection");
          const t = await testTTLockConnection(scope.userId);
          return result(provider, { ok: t.ok, skipped: false, message: t.message, actions });
        }
        return result(provider, {
          ok: true,
          skipped: false,
          message: "TTLock reconectado y sincronizado",
          actions,
        });
      }
      case "AIRBNB_ICAL": {
        actions.push("handleAirbnbSyncAll");
        const { summary } = await handleAirbnbSyncAll(scope.userId);
        const errors = summary.results.filter((x) => x.error).length;
        return result(provider, {
          ok: errors === 0,
          skipped: false,
          message:
            errors === 0
              ? `iCal sincronizado (${summary.propertiesSynced} propiedad(es))`
              : `iCal sincronizado con ${errors} error(es)`,
          actions,
        });
      }
      case "SIRE":
      case "TRAA": {
        actions.push("testExternalIntegration");
        const r = await testExternalIntegration(provider, scope.organizationId);
        return result(provider, { ok: r.ok, skipped: false, message: r.message, actions });
      }
    }
  } catch (error) {
    return result(provider, {
      ok: false,
      skipped: false,
      message: error instanceof Error ? error.message : `Recuperación falló (${report.id})`,
      actions,
    });
  }
}

/**
 * Re-checks health, then runs the existing reconnect/test/sync actions only when
 * the integration is unhealthy AND recoverable. Idempotent:
 *  - healthy / non-recoverable → skipped, nothing called
 *  - concurrent calls for the same scope+provider share one execution
 *  - repeat calls within the cooldown are skipped
 * Never invents credentials: providers needing user input stay `canRecover: false`.
 */
export async function recoverIntegration(
  provider: IntegrationHealthProvider,
  scope: IntegrationHealthScope,
  options: { canManage?: boolean; bypassCooldown?: boolean } = {},
): Promise<IntegrationRecoveryResult> {
  const key = recoveryKey(provider, scope);
  const running = inFlight.get(key);
  if (running) return running;

  const promise = (async (): Promise<IntegrationRecoveryResult> => {
    await assertBillingUnlocked();

    const [report] = await getAllIntegrationHealth(scope, {
      providers: [provider],
      canManage: options.canManage,
    });
    if (!report) {
      return result(provider, { ok: true, skipped: true, message: "Integración no configurada" });
    }
    if (report.status === "CONNECTED") {
      return result(provider, { ok: true, skipped: true, message: "Ya está conectada" });
    }
    if (!report.canRecover) {
      return result(provider, {
        ok: false,
        skipped: true,
        message: "Requiere acción manual (credenciales o configuración)",
      });
    }

    const last = lastAttemptAt.get(key);
    if (!options.bypassCooldown && last && Date.now() - last < RECOVERY_COOLDOWN_MS) {
      return result(provider, {
        ok: true,
        skipped: true,
        message: "Recuperación reciente — espera un minuto antes de reintentar",
      });
    }
    lastAttemptAt.set(key, Date.now());
    return runRecovery(provider, scope, report);
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}

/** Sequentially recovers every unhealthy + recoverable integration (no parallel blast). */
export async function recoverAllIntegrations(
  scope: IntegrationHealthScope,
  options: {
    providers?: readonly IntegrationHealthProvider[];
    canManage?: boolean;
  } = {},
): Promise<IntegrationRecoveryResult[]> {
  const reports = await getAllIntegrationHealth(scope, options);
  const results: IntegrationRecoveryResult[] = [];
  for (const report of reports) {
    if (report.status === "CONNECTED" || !report.canRecover) continue;
    results.push(await recoverIntegration(report.provider, scope, options));
  }
  return results;
}
