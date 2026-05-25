"use server";

import { revalidatePath } from "next/cache";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { runPriceLabsSyncPipeline } from "@/services/integrations/pricelabs/pricelabs-orchestrator";
import { runWithPriceLabsSyncLock } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import { runWithPriceLabsOrganization } from "@/services/integrations/pricelabs/pricelabs-org-context";
import {
  checkConnection,
  fetchDynamicPrices,
  markPriceLabsSetupFromPanel,
  revokePriceLabsApiKeyFromPanel,
  savePriceLabsApiKeyFromPanel,
  syncListings,
  syncPriceLabsOverrides,
  deletePriceLabsOverridesFromPanel,
  savePriceLabsOverridesFromPanel,
  syncSingleListing,
} from "@/services/integrations/pricelabs.service";

async function requireIntegrationsManageUnlocked() {
  const user = await requirePermission("integrations:manage");
  await assertBillingUnlocked();
  return user;
}

async function withPriceLabsOrg<T>(fn: () => Promise<T>): Promise<T> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    throw new Error("Organización no disponible para integración PriceLabs");
  }
  return runWithPriceLabsOrganization(scope.organizationId, fn);
}

function revalidatePriceLabs() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/pricelabs");
  revalidatePath("/revenue");
  revalidatePath("/calendar");
}

export async function savePriceLabsApiKeyAction(apiKey: string) {
  const user = await requireIntegrationsManageUnlocked();
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { ok: false, message: "Organización no disponible" };
  }
  const result = await withPriceLabsOrg(() =>
    savePriceLabsApiKeyFromPanel({
      configuredById: user.dbUserId,
      organizationId: scope.organizationId!,
      apiKey,
    }),
  );
  revalidatePriceLabs();
  return result;
}

export async function revokePriceLabsApiKeyAction() {
  await requireIntegrationsManageUnlocked();
  const result = await withPriceLabsOrg(() => revokePriceLabsApiKeyFromPanel());
  revalidatePriceLabs();
  return result;
}

/** Alias for disconnect in UX */
export async function disconnectPriceLabsAction() {
  return revokePriceLabsApiKeyAction();
}

export async function syncPriceLabsOverridesAction() {
  await requireIntegrationsManageUnlocked();
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { ok: false, message: "Organización no disponible" };
  }
  const wrapped = await withPriceLabsOrg(() =>
    runWithPriceLabsSyncLock(
      () => syncPriceLabsOverrides(),
      scope.organizationId!,
    ),
  );
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function confirmPriceLabsSetupAction() {
  const user = await requireIntegrationsManageUnlocked();
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { ok: false, message: "Organización no disponible" };
  }
  const result = await withPriceLabsOrg(() =>
    markPriceLabsSetupFromPanel({
      configuredById: user.dbUserId,
      organizationId: scope.organizationId!,
    }),
  );
  revalidatePriceLabs();
  return result;
}

export async function testPriceLabsConnectionAction() {
  await requireIntegrationsManageUnlocked();
  const result = await withPriceLabsOrg(() => checkConnection());
  revalidatePriceLabs();
  return result;
}

export async function syncPriceLabsListingsAction() {
  await requireIntegrationsManageUnlocked();
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { ok: false, message: "Organización no disponible" };
  }
  const wrapped = await withPriceLabsOrg(() =>
    runWithPriceLabsSyncLock(
      () => syncListings(),
      scope.organizationId!,
    ),
  );
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function fetchPriceLabsPricesAction() {
  await requireIntegrationsManageUnlocked();
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return { ok: false, message: "Organización no disponible" };
  }
  const wrapped = await withPriceLabsOrg(() =>
    runWithPriceLabsSyncLock(
      () => fetchDynamicPrices(),
      scope.organizationId!,
    ),
  );
  if (!wrapped.ok) return { ok: false, message: wrapped.message };
  revalidatePriceLabs();
  return wrapped.value;
}

export async function runPriceLabsFullSyncAction() {
  await requireIntegrationsManageUnlocked();
  const result = await withPriceLabsOrg(() =>
    runPriceLabsSyncPipeline({ source: "manual" }),
  );
  revalidatePriceLabs();
  return result;
}

export async function syncSinglePriceLabsListingAction(propertyId: string) {
  await requireIntegrationsManageUnlocked();
  const result = await withPriceLabsOrg(() => syncSingleListing(propertyId));
  revalidatePriceLabs();
  return result;
}

export async function savePriceLabsOverrideAction(input: {
  propertyId: string;
  date: string;
  price?: string;
  minStay?: string;
  minPrice?: string;
  maxPrice?: string;
}) {
  await requireIntegrationsManageUnlocked();
  const result = await withPriceLabsOrg(() => savePriceLabsOverridesFromPanel(input));
  revalidatePriceLabs();
  return result;
}

export async function deletePriceLabsOverridesAction(input: {
  propertyId: string;
  dates: string[];
}) {
  await requireIntegrationsManageUnlocked();
  const result = await withPriceLabsOrg(() => deletePriceLabsOverridesFromPanel(input));
  revalidatePriceLabs();
  return result;
}
