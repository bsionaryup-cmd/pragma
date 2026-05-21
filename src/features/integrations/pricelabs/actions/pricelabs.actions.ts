"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { runPriceLabsSyncPipeline } from "@/services/integrations/pricelabs/pricelabs-orchestrator";
import { runWithPriceLabsSyncLock } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import {
  checkConnection,
  fetchDynamicPrices,
  markPriceLabsSetupFromPanel,
  syncListings,
  syncSingleListing,
} from "@/services/integrations/pricelabs.service";

function revalidatePriceLabs() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/pricelabs");
  revalidatePath("/calendar");
}

export async function confirmPriceLabsSetupAction() {
  const user = await requireRole("ADMIN");
  const result = await markPriceLabsSetupFromPanel({
    configuredById: user.dbUserId,
  });
  revalidatePriceLabs();
  return result;
}

export async function testPriceLabsConnectionAction() {
  await requireRole("ADMIN");
  const result = await checkConnection();
  revalidatePriceLabs();
  return result;
}

export async function syncPriceLabsListingsAction() {
  await requireRole("ADMIN");
  const wrapped = await runWithPriceLabsSyncLock(() => syncListings());
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function fetchPriceLabsPricesAction() {
  await requireRole("ADMIN");
  const wrapped = await runWithPriceLabsSyncLock(() => fetchDynamicPrices());
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function runPriceLabsFullSyncAction() {
  await requireRole("ADMIN");
  const result = await runPriceLabsSyncPipeline({ source: "manual" });
  revalidatePriceLabs();
  return result;
}

export async function syncSinglePriceLabsListingAction(propertyId: string) {
  await requireRole("ADMIN");
  const result = await syncSingleListing(propertyId);
  revalidatePriceLabs();
  return result;
}
