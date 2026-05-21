import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { isPriceLabsConfiguredAsync } from "@/services/integrations/pricelabs/pricelabs-credentials";
import { runPriceLabsSyncPipeline } from "@/services/integrations/pricelabs/pricelabs-orchestrator";
import { isPriceLabsSyncInProgress } from "@/services/integrations/pricelabs/pricelabs-sync-lock";

const DEBOUNCE_MS = 60_000;
let lastScheduledAt = 0;
let pending = false;

/** Debounced refresh after reservation changes (server-only). */
export function schedulePriceLabsRefresh(
  source: "reservation" | "system" = "reservation",
): void {
  const now = Date.now();
  if (pending || now - lastScheduledAt < DEBOUNCE_MS) return;
  lastScheduledAt = now;
  pending = true;

  void (async () => {
    try {
      const billing = await getBillingAccessSnapshot();
      if (billing.locked) return;
      if (!(await isPriceLabsConfiguredAsync())) return;
      if (await isPriceLabsSyncInProgress()) return;
      await runPriceLabsSyncPipeline({
        source,
        skipConnectionTest: true,
      });
    } catch (error) {
      console.warn("[pricelabs] scheduled refresh failed", error);
    } finally {
      pending = false;
    }
  })();
}
