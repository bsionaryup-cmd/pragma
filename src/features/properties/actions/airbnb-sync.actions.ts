"use server";

import { requirePermission } from "@/lib/auth";
import { buildIcalExportUrl, ensurePropertyIcalExportToken } from "@/services/airbnb/ical-export.service";
import { disconnectPropertyAirbnbIcal } from "@/services/airbnb/airbnb-ical-disconnect.service";
import {
  handleAirbnbSyncStatus,
  runAirbnbSyncAllWithRevalidate,
  runAirbnbSyncCleanupWithRevalidate,
  runAirbnbSyncPropertyWithRevalidate,
} from "@/services/airbnb/airbnb-auto-sync.handlers";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { getPropertyById } from "@/services/properties/property.service";

export async function syncAirbnbCalendarsAction() {
  const user = await requirePermission("properties:write");
  return runAirbnbSyncAllWithRevalidate(user.dbUserId);
}

export async function syncPropertyAirbnbAction(propertyId: string) {
  const user = await requirePermission("properties:write");
  return runAirbnbSyncPropertyWithRevalidate(user.dbUserId, propertyId);
}

export async function cleanupDisconnectedAirbnbImportsAction() {
  const user = await requirePermission("properties:write");
  return runAirbnbSyncCleanupWithRevalidate(user.dbUserId);
}

export async function getAirbnbSyncStatusAction() {
  const user = await requirePermission("properties:read");
  return handleAirbnbSyncStatus(user.dbUserId);
}

export async function disconnectPropertyAirbnbIcalAction(propertyId: string) {
  const user = await requirePermission("properties:write");
  await assertBillingUnlocked();
  const result = await disconnectPropertyAirbnbIcal(propertyId, user.dbUserId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/properties");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true as const, result };
}

export async function getPropertyIcalExportUrlAction(propertyId: string) {
  const user = await requirePermission("properties:read");
  const property = await getPropertyById(propertyId, user.dbUserId);
  if (!property) throw new Error("Propiedad no encontrada");

  const token = await ensurePropertyIcalExportToken(propertyId);
  return {
    success: true as const,
    url: buildIcalExportUrl(propertyId, token),
  };
}
