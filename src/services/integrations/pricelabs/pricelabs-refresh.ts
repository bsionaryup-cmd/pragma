import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { isPriceLabsConfiguredAsync } from "@/services/integrations/pricelabs/pricelabs-credentials";
import { runPriceLabsSyncPipeline } from "@/services/integrations/pricelabs/pricelabs-orchestrator";
import { runWithPriceLabsOrganization } from "@/services/integrations/pricelabs/pricelabs-org-context";
import { isPriceLabsSyncInProgress } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";

const DEBOUNCE_MS = 60_000;
let lastScheduledAt = 0;
let pending = false;

/** Debounced refresh after reservation changes (server-only, org-scoped). */
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
      const scope = await requireTenantDataScope();
      if (!scope.organizationId) return;
      const organizationId = scope.organizationId;
      await runWithPriceLabsOrganization(organizationId, async () => {
        if (!(await isPriceLabsConfiguredAsync(organizationId))) return;
        if (await isPriceLabsSyncInProgress(organizationId)) return;
        await runPriceLabsSyncPipeline({
          source,
          skipConnectionTest: true,
          organizationId,
        });
      });
    } catch (error) {
      console.warn("[pricelabs] scheduled refresh failed", error);
    } finally {
      pending = false;
    }
  })();
}
