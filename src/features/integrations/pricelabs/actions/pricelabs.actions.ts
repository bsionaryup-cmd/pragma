"use server";

import { revalidatePath } from "next/cache";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requirePermission } from "@/lib/auth";

async function requireIntegrationsManageUnlocked() {
  const user = await requirePermission("integrations:manage");
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
  revalidatePath("/revenue");
  revalidatePath("/calendar");
}

export async function savePriceLabsApiKeyAction(apiKey: string) {
  const user = await requireIntegrationsManageUnlocked();
  const result = await savePriceLabsApiKeyFromPanel({
    configuredById: user.dbUserId,
    apiKey,
  });
  revalidatePriceLabs();
  return result;
}

export async function revokePriceLabsApiKeyAction() {
  await requireIntegrationsManageUnlocked();
  const result = await revokePriceLabsApiKeyFromPanel();
  revalidatePriceLabs();
  return result;
}

export async function syncPriceLabsOverridesAction() {
  await requireIntegrationsManageUnlocked();
  const wrapped = await runWithPriceLabsSyncLock(() => syncPriceLabsOverrides());
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function confirmPriceLabsSetupAction() {
  const user = await requireIntegrationsManageUnlocked();
  const result = await markPriceLabsSetupFromPanel({
    configuredById: user.dbUserId,
  });
  revalidatePriceLabs();
  return result;
}

export async function testPriceLabsConnectionAction() {
  await requireIntegrationsManageUnlocked();
  const result = await checkConnection();
  revalidatePriceLabs();
  return result;
}

export async function syncPriceLabsListingsAction() {
  await requireIntegrationsManageUnlocked();
  const wrapped = await runWithPriceLabsSyncLock(() => syncListings());
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function fetchPriceLabsPricesAction() {
  await requireIntegrationsManageUnlocked();
  const wrapped = await runWithPriceLabsSyncLock(() => fetchDynamicPrices());
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function runPriceLabsFullSyncAction() {
  await requireIntegrationsManageUnlocked();
  const result = await runPriceLabsSyncPipeline({ source: "manual" });
  revalidatePriceLabs();
  return result;
}

export async function syncSinglePriceLabsListingAction(propertyId: string) {
  await requireIntegrationsManageUnlocked();
  const result = await syncSingleListing(propertyId);
  revalidatePriceLabs();
  return result;
}
