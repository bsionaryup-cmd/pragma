"use server";

import { revalidatePath } from "next/cache";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requireRole } from "@/lib/auth";

async function requireAdminUnlocked() {
  const user = await requireRole("ADMIN");
  await assertBillingUnlocked();
  return user;
}
import { runPriceLabsSyncPipeline } from "@/services/integrations/pricelabs/pricelabs-orchestrator";
import { runWithPriceLabsSyncLock } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import {
  checkConnection,
  fetchDynamicPrices,
  markPriceLabsSetupFromPanel,
  revokePriceLabsApiKeyFromPanel,
  savePriceLabsApiKeyFromPanel,
  syncListings,
  syncPriceLabsOverrides,
  syncSingleListing,
} from "@/services/integrations/pricelabs.service";

function revalidatePriceLabs() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/pricelabs");
  revalidatePath("/calendar");
}

export async function savePriceLabsApiKeyAction(apiKey: string) {
  const user = await requireAdminUnlocked();
  const result = await savePriceLabsApiKeyFromPanel({
    configuredById: user.dbUserId,
    apiKey,
  });
  revalidatePriceLabs();
  return result;
}

export async function revokePriceLabsApiKeyAction() {
  await requireAdminUnlocked();
  const result = await revokePriceLabsApiKeyFromPanel();
  revalidatePriceLabs();
  return result;
}

export async function syncPriceLabsOverridesAction() {
  await requireRole("ADMIN");
  const wrapped = await runWithPriceLabsSyncLock(() => syncPriceLabsOverrides());
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function confirmPriceLabsSetupAction() {
  const user = await requireAdminUnlocked();
  const result = await markPriceLabsSetupFromPanel({
    configuredById: user.dbUserId,
  });
  revalidatePriceLabs();
  return result;
}

export async function testPriceLabsConnectionAction() {
  await requireAdminUnlocked();
  const result = await checkConnection();
  revalidatePriceLabs();
  return result;
}

export async function syncPriceLabsListingsAction() {
  await requireAdminUnlocked();
  const wrapped = await runWithPriceLabsSyncLock(() => syncListings());
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function fetchPriceLabsPricesAction() {
  await requireAdminUnlocked();
  const wrapped = await runWithPriceLabsSyncLock(() => fetchDynamicPrices());
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function runPriceLabsFullSyncAction() {
  await requireAdminUnlocked();
  const result = await runPriceLabsSyncPipeline({ source: "manual" });
  revalidatePriceLabs();
  return result;
}

export async function syncSinglePriceLabsListingAction(propertyId: string) {
  await requireAdminUnlocked();
  const result = await syncSingleListing(propertyId);
  revalidatePriceLabs();
  return result;
}
