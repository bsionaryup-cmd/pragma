import { OrganizationIntegrationStatus } from "@prisma/client";
import {
  checkConnection,
  fetchDynamicPrices,
  refreshListingBoundsFromRemote,
  syncListings,
} from "@/integrations/pricelabs/service";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { isPriceLabsConfiguredAsync } from "@/services/integrations/pricelabs/pricelabs-credentials";
import { appendPriceLabsSyncLog } from "@/services/integrations/pricelabs/pricelabs-audit";
import { runWithPriceLabsSyncLock } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import { updatePriceLabsIntegrationState } from "@/services/integrations/pricelabs/pricelabs-persistence";
import { runWithPriceLabsOrganization } from "@/services/integrations/pricelabs/pricelabs-org-context";
import { listConnectedPriceLabsOrganizations } from "@/services/integrations/organization-integration.service";

export type PriceLabsPipelineSource = "manual" | "cron" | "reservation" | "system";
export type PriceLabsPipelineMode = "full" | "pricesOnly";

export async function runPriceLabsSyncPipeline(input?: {
  source?: PriceLabsPipelineSource;
  skipConnectionTest?: boolean;
  organizationId?: string;
  /** full = listings + precios (manual). pricesOnly = solo precios (cron, calendario, reservas). */
  mode?: PriceLabsPipelineMode;
}): Promise<{ ok: boolean; message: string }> {
  const source = input?.source ?? "manual";
  const mode = input?.mode ?? "full";

  if (source !== "cron") {
    try {
      await assertBillingUnlocked();
    } catch {
      return {
        ok: false,
        message: "Cuenta en modo restringido — regulariza el pago en facturación",
      };
    }
  }

  const scope = input?.organizationId
    ? { organizationId: input.organizationId, userId: "" }
    : await requireTenantDataScope();

  if (!scope.organizationId) {
    return { ok: false, message: "Organización no disponible" };
  }

  const organizationId = scope.organizationId;

  return runWithPriceLabsOrganization(organizationId, async () => {
    if (!(await isPriceLabsConfiguredAsync(organizationId))) {
      await appendPriceLabsSyncLog({
        action: "pipeline",
        result: "skipped",
        message: "API key PriceLabs no configurada",
        source,
        organizationId: organizationId,
      });
      return {
        ok: false,
        message: "Configura la API key de PriceLabs en Integraciones → PriceLabs",
      };
    }

    const locked = await runWithPriceLabsSyncLock(async () => {
      if (mode === "full") {
        await updatePriceLabsIntegrationState({
          status: OrganizationIntegrationStatus.SYNC_REQUIRED,
          lastError: null,
          organizationId,
        });
      }

      if (!input?.skipConnectionTest && mode === "full") {
        const health = await checkConnection();
        await appendPriceLabsSyncLog({
          action: "test_connection",
          result: health.ok ? "success" : "failure",
          message: health.message,
          source,
          organizationId,
        });
        if (!health.ok) return { ok: false, message: health.message };
      }

      let listingsSynced = 0;

      if (mode === "full") {
        const listings = await syncListings();
        await appendPriceLabsSyncLog({
          action: "sync_listings",
          result: listings.ok ? "success" : "failure",
          message: listings.message,
          source,
          organizationId,
          meta: { synced: listings.synced, failed: listings.failed },
        });
        if (!listings.ok) return { ok: false, message: listings.message };
        listingsSynced = listings.synced;
      }

      const boundsPull = await refreshListingBoundsFromRemote();
      await appendPriceLabsSyncLog({
        action: "refresh_listing_bounds",
        result: boundsPull.ok ? "success" : "failure",
        message: boundsPull.message,
        source,
        organizationId,
        meta: {
          updated: boundsPull.updated,
          adopted: boundsPull.adopted,
          mode,
        },
      });

      const prices = await fetchDynamicPrices();
      await appendPriceLabsSyncLog({
        action: "fetch_prices",
        result: prices.ok ? "success" : "failure",
        message: prices.message,
        source,
        organizationId,
        meta: {
          updated: prices.updated,
          failed: prices.failed,
          skipped: prices.skipped,
          mode,
        },
      });

      if (prices.ok) {
        await updatePriceLabsIntegrationState({
          status:
            prices.failed > 0
              ? OrganizationIntegrationStatus.DEGRADED
              : OrganizationIntegrationStatus.CONNECTED,
          lastSyncAt: new Date(),
          lastError:
            prices.failed > 0
              ? `${prices.failed} propiedad(es) sin precios`
              : null,
          organizationId,
        });
      }

      return {
        ok: prices.ok,
        message: prices.ok
          ? mode === "full"
            ? `Pipeline: ${listingsSynced} listings, ${prices.updated} precios`
            : `Precios actualizados (${prices.updated})`
          : prices.message,
      };
    }, organizationId);

    if (!locked.ok) return locked;
    return locked.value;
  });
}

/** Cron: sync all organizations with connected PriceLabs */
export async function runPriceLabsCronSyncForAllOrganizations(): Promise<{
  ok: boolean;
  message: string;
  processed: number;
}> {
  const orgs = await listConnectedPriceLabsOrganizations();
  if (orgs.length === 0) {
    return { ok: true, message: "Sin organizaciones PriceLabs conectadas", processed: 0 };
  }

  let okCount = 0;
  for (const { organizationId } of orgs) {
    const result = await runPriceLabsSyncPipeline({
      source: "cron",
      skipConnectionTest: true,
      mode: "pricesOnly",
      organizationId,
    });
    if (result.ok) okCount += 1;
  }

  return {
    ok: okCount > 0,
    message: `Cron PriceLabs: ${okCount}/${orgs.length} organizaciones sincronizadas`,
    processed: orgs.length,
  };
}
