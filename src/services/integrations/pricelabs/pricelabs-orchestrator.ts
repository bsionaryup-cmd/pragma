import { PriceLabsIntegrationStatus } from "@prisma/client";
import {
  checkConnection,
  fetchDynamicPrices,
  syncListings,
} from "@/integrations/pricelabs/service";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { isPriceLabsConfiguredAsync } from "@/services/integrations/pricelabs/pricelabs-credentials";
import { appendPriceLabsSyncLog } from "@/services/integrations/pricelabs/pricelabs-audit";
import { runWithPriceLabsSyncLock } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import { updatePriceLabsIntegrationState } from "@/services/integrations/pricelabs/pricelabs-persistence";

export type PriceLabsPipelineSource = "manual" | "cron" | "reservation" | "system";

export async function runPriceLabsSyncPipeline(input?: {
  source?: PriceLabsPipelineSource;
  skipConnectionTest?: boolean;
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

  if (!(await isPriceLabsConfiguredAsync())) {
    await appendPriceLabsSyncLog({
      action: "pipeline",
      result: "skipped",
      message: "PRICELABS_API_KEY no configurada",
      source,
    });
    return {
      ok: false,
      message: "Configura PRICELABS_API_KEY en el entorno del servidor",
    };
  }

  const locked = await runWithPriceLabsSyncLock(async () => {
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.PENDING_SETUP,
      lastError: null,
    });

    if (!input?.skipConnectionTest) {
      const health = await checkConnection();
      await appendPriceLabsSyncLog({
        action: "test_connection",
        result: health.ok ? "success" : "failure",
        message: health.message,
        source,
      });
      if (!health.ok) return { ok: false, message: health.message };
    }

    const listings = await syncListings();
    await appendPriceLabsSyncLog({
      action: "sync_listings",
      result: listings.ok ? "success" : "failure",
      message: listings.message,
      source,
      meta: { synced: listings.synced, failed: listings.failed },
    });
    if (!listings.ok) return { ok: false, message: listings.message };

    const prices = await fetchDynamicPrices();
    await appendPriceLabsSyncLog({
      action: "fetch_prices",
      result: prices.ok ? "success" : "failure",
      message: prices.message,
      source,
      meta: {
        updated: prices.updated,
        failed: prices.failed,
        skipped: prices.skipped,
      },
    });

    return {
      ok: prices.ok,
      message: prices.ok
        ? `Pipeline: ${listings.synced} listings, ${prices.updated} precios`
        : prices.message,
    };
  });

  if (!locked.ok) return locked;
  return locked.value;
}
