import { revalidatePath } from "next/cache";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { isPriceLabsConfiguredAsync } from "@/services/integrations/pricelabs/pricelabs-credentials";
import {
  runPriceLabsSyncPipeline,
  type PriceLabsPipelineSource,
} from "@/services/integrations/pricelabs/pricelabs-orchestrator";
import { runWithPriceLabsOrganization } from "@/services/integrations/pricelabs/pricelabs-org-context";
import { isPriceLabsSyncInProgress } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import type { StoredPriceLabsMeta } from "@/integrations/pricelabs/types";

const DEBOUNCE_MS = 60_000;
const CALENDAR_STALE_MS = 2 * 60 * 60 * 1000;

let lastScheduledAt = 0;
let pending = false;

type CalendarPropertyPriceLabs = {
  listingId: string | null;
  meta: unknown;
};

function propertyNeedsPriceRefresh(
  priceLabs: CalendarPropertyPriceLabs | null | undefined,
  now: number,
): boolean {
  if (!priceLabs?.listingId?.trim()) return false;

  const meta =
    priceLabs.meta &&
    typeof priceLabs.meta === "object" &&
    !Array.isArray(priceLabs.meta)
      ? (priceLabs.meta as StoredPriceLabsMeta)
      : null;

  const dailyPrices = meta?.dailyPrices;
  if (!Array.isArray(dailyPrices) || dailyPrices.length === 0) {
    return true;
  }

  const lastSync = meta?.lastPricesSync;
  if (!lastSync) return true;

  const age = now - Date.parse(lastSync);
  return Number.isFinite(age) && age > CALENDAR_STALE_MS;
}

function scheduleBackgroundPriceSync(source: PriceLabsPipelineSource): void {
  const now = Date.now();
  if (pending || now - lastScheduledAt < DEBOUNCE_MS) return;
  lastScheduledAt = now;
  pending = true;

  void (async () => {
    try {
      const billing = await getBillingAccessSnapshot();
      if (billing.locked) return;
      const scope = await requireTenantDataScope();
      if (!scope.organizationId) return;
      const organizationId = scope.organizationId;
      await runWithPriceLabsOrganization(organizationId, async () => {
        if (!(await isPriceLabsConfiguredAsync(organizationId))) return;
        if (await isPriceLabsSyncInProgress(organizationId)) return;
        const result = await runPriceLabsSyncPipeline({
          source,
          skipConnectionTest: true,
          mode: "pricesOnly",
          organizationId,
        });
        if (result.ok) {
          revalidatePath("/calendar");
          revalidatePath("/revenue");
        }
      });
    } catch (error) {
      console.warn("[pricelabs] scheduled refresh failed", error);
    } finally {
      pending = false;
    }
  })();
}

/** Debounced refresh after reservation changes (solo precios, no re-mapea listings). */
export function schedulePriceLabsRefresh(
  source: "reservation" | "system" = "reservation",
): void {
  scheduleBackgroundPriceSync(source);
}

/** Al abrir calendario: re-sincroniza precios si faltan o están desactualizados. */
export function schedulePriceLabsCalendarRefreshIfStale(
  properties: Array<{ priceLabs?: CalendarPropertyPriceLabs | null }>,
): void {
  const now = Date.now();
  const needsRefresh = properties.some((property) =>
    propertyNeedsPriceRefresh(property.priceLabs, now),
  );
  if (!needsRefresh) return;
  scheduleBackgroundPriceSync("system");
}
