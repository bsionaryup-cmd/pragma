import { OrganizationIntegrationStatus } from "@prisma/client";
import {
  checkConnection,
  fetchDynamicPrices,
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

export async function runPriceLabsSyncPipeline(input?: {
  source?: PriceLabsPipelineSource;
  skipConnectionTest?: boolean;
  organizationId?: string;
}): Promise<{ ok: boolean; message: string }> {
  const source = input?.source ?? "manual";

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
      await updatePriceLabsIntegrationState({
        status: OrganizationIntegrationStatus.SYNC_REQUIRED,
        lastError: null,
        organizationId,
      });

      if (!input?.skipConnectionTest) {
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
        },
      });

      if (prices.ok) {
        await updatePriceLabsIntegrationState({
          lastSyncAt: new Date(),
          organizationId,
        });
      }

      return {
        ok: prices.ok,
        message: prices.ok
          ? `Pipeline: ${listings.synced} listings, ${prices.updated} precios`
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
