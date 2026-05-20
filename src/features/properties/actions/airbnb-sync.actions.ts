"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { withTimeout } from "@/lib/async-timeout";

const AIRBNB_SYNC_TIMEOUT_MS = 45_000;
import {
  buildIcalExportUrl,
  ensurePropertyIcalExportToken,
} from "@/services/airbnb/ical-export.service";
import {
  getAirbnbSyncStatusForOwner,
  syncAllAirbnbCalendarsForOwner,
  syncPropertyIcalCalendar,
} from "@/services/airbnb/airbnb-ical-sync.service";
import { getPropertyById } from "@/services/properties/property.service";

function revalidateSyncedPaths() {
  revalidatePath("/properties");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function syncAirbnbCalendarsAction() {
  const user = await requirePermission("properties:write");
  try {
    const summary = await withTimeout(
      syncAllAirbnbCalendarsForOwner(user.dbUserId),
      AIRBNB_SYNC_TIMEOUT_MS,
      "La sincronización con Airbnb tardó demasiado. Comprueba la base de datos y vuelve a intentarlo.",
    );
    revalidateSyncedPaths();
    return { success: true as const, summary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al sincronizar Airbnb";
    throw new Error(message);
  }
}

export async function syncPropertyAirbnbAction(propertyId: string) {
  const user = await requirePermission("properties:write");
  const result = await syncPropertyIcalCalendar(propertyId, user.dbUserId);
  revalidateSyncedPaths();
  return { success: true as const, result };
}

export async function getAirbnbSyncStatusAction() {
  const user = await requirePermission("properties:read");
  const status = await getAirbnbSyncStatusForOwner(user.dbUserId);
  return { success: true as const, status };
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
