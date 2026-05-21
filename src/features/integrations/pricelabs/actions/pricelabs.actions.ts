"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  checkConnection,
  connectPriceLabs,
  fetchDynamicPrices,
  syncListings,
  syncSingleListing,
} from "@/services/integrations/pricelabs.service";

function revalidatePriceLabs() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/pricelabs");
}

export async function connectPriceLabsAction(formData: FormData) {
  const user = await requireRole("ADMIN");
  const userToken = String(formData.get("userToken") ?? "").trim();
  const result = await connectPriceLabs({
    configuredById: user.dbUserId,
    userToken: userToken || undefined,
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
  const result = await syncListings();
  revalidatePriceLabs();
  return result;
}

export async function fetchPriceLabsPricesAction() {
  await requireRole("ADMIN");
  const result = await fetchDynamicPrices();
  revalidatePriceLabs();
  return result;
}

export async function syncSinglePriceLabsListingAction(propertyId: string) {
  await requireRole("ADMIN");
  const result = await syncSingleListing(propertyId);
  revalidatePriceLabs();
  return result;
}
