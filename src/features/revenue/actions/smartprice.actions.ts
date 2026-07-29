"use server";

import { revalidatePath } from "next/cache";
import {
  assertBillingUnlocked,
  isBillingLockedError,
} from "@/lib/billing/billing-guard";
import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { runWithPriceLabsOrganization } from "@/services/integrations/pricelabs/pricelabs-org-context";
import { runWithPriceLabsSyncLock } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import {
  deletePriceLabsOverridesFromPanel,
  savePriceLabsOverridesFromPanel,
  savePropertyPriceBoundsFromPanel,
  syncSingleListing,
} from "@/services/integrations/pricelabs.service";

type ActionResult = { ok: boolean; message: string };

function revalidateRevenuePaths() {
  revalidatePath("/revenue");
  revalidatePath("/calendar");
  revalidatePath("/integrations");
  revalidatePath("/integrations/pricelabs");
}

async function withRevenueOrg<T>(fn: () => Promise<T>): Promise<T> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    throw new Error("Organización no disponible");
  }
  return runWithPriceLabsOrganization(scope.organizationId, fn);
}

/**
 * Panel mutations (bounds/overrides) must NOT share the org sync lock.
 * That lock is for pipeline sync only; coupling caused false
 * "Sincronización ya en curso" while Tarifas could not save.
 */
async function runRevenueMutation(
  fn: () => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    await requirePermission("finance:write");
    await assertBillingUnlocked();
    const result = await withRevenueOrg(fn);
    if (result.ok) {
      revalidateRevenuePaths();
    }
    return result;
  } catch (error) {
    if (isBillingLockedError(error)) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error inesperado",
    };
  }
}

export async function savePropertyPriceBoundsAction(input: {
  propertyId: string;
  baseRate?: string;
  minRate?: string;
  maxRate?: string;
}): Promise<ActionResult> {
  return runRevenueMutation(() => savePropertyPriceBoundsFromPanel(input));
}

export async function savePriceLabsOverrideAction(input: {
  propertyId: string;
  date: string;
  price?: string;
  minStay?: string;
  minPrice?: string;
  maxPrice?: string;
}): Promise<ActionResult> {
  return runRevenueMutation(() => savePriceLabsOverridesFromPanel(input));
}

export async function deletePriceLabsOverridesAction(input: {
  propertyId: string;
  dates: string[];
}): Promise<ActionResult> {
  return runRevenueMutation(() => deletePriceLabsOverridesFromPanel(input));
}

/** Listing refresh still uses the sync lock to avoid overlapping pipelines. */
export async function syncSinglePriceLabsListingAction(
  propertyId: string,
): Promise<ActionResult & { listingId?: string }> {
  try {
    await requirePermission("finance:write");
    await assertBillingUnlocked();
    const scope = await requireTenantDataScope();
    if (!scope.organizationId) {
      return { ok: false, message: "Organización no disponible" };
    }

    const locked = await runWithPriceLabsSyncLock(
      () => withRevenueOrg(() => syncSingleListing(propertyId)),
      scope.organizationId,
    );
    if (!locked.ok) {
      return { ok: false, message: locked.message };
    }
    if (locked.value.ok) {
      revalidateRevenuePaths();
    }
    return locked.value;
  } catch (error) {
    if (isBillingLockedError(error)) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error inesperado",
    };
  }
}

/** Portfolio price refresh from Tarifas (finance:write) — pricesOnly pipeline. */
export async function syncRevenuePricesAction(): Promise<ActionResult> {
  try {
    await requirePermission("finance:write");
    await assertBillingUnlocked();
    const scope = await requireTenantDataScope();
    if (!scope.organizationId) {
      return { ok: false, message: "Organización no disponible" };
    }
    const { runPriceLabsSyncPipeline } = await import(
      "@/services/integrations/pricelabs/pricelabs-orchestrator"
    );
    const result = await runWithPriceLabsOrganization(scope.organizationId, () =>
      runPriceLabsSyncPipeline({
        source: "manual",
        skipConnectionTest: true,
        mode: "pricesOnly",
        organizationId: scope.organizationId!,
      }),
    );
    if (result.ok) {
      revalidateRevenuePaths();
    }
    return result;
  } catch (error) {
    if (isBillingLockedError(error)) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error inesperado",
    };
  }
}
