"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { withTimeout } from "@/lib/async-timeout";

const AIRBNB_SYNC_TIMEOUT_MS = 120_000;
import {
  buildIcalExportUrl,
  ensurePropertyIcalExportToken,
} from "@/services/airbnb/ical-export.service";
import { hasActiveAirbnbIcalImport } from "@/lib/airbnb/ical-sync-utils";
import { disconnectPropertyAirbnbIcal } from "@/services/airbnb/airbnb-ical-disconnect.service";
import {
  getAirbnbSyncStatusForOwner,
  syncAllAirbnbCalendarsForOwner,
  syncPropertyIcalCalendar,
} from "@/services/airbnb/airbnb-ical-sync.service";
import { getPropertyById } from "@/services/properties/property.service";
import { db } from "@/lib/db";

function revalidateSyncedPaths() {
  revalidatePath("/properties");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function syncAirbnbCalendarsAction() {
  const user = await requirePermission("properties:write");
  const linked = await db.property.findMany({
    where: { ownerId: user.dbUserId },
    select: { icalUrl: true },
  });
  const hasAnyLinked = linked.some((p) => hasActiveAirbnbIcalImport(p.icalUrl));
  if (!hasAnyLinked) {
    return {
      success: true as const,
      summary: {
        propertiesSynced: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        skipped: 0,
        echoSkipped: 0,
        results: [],
        lastSyncedAt: null,
        durationMs: 0,
      },
    };
  }
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
  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId: user.dbUserId },
    select: { icalUrl: true, name: true },
  });
  if (!property) throw new Error("Propiedad no encontrada");
  if (!hasActiveAirbnbIcalImport(property.icalUrl)) {
    throw new Error("Esta propiedad no tiene iCal de Airbnb conectado");
  }
  const result = await syncPropertyIcalCalendar(propertyId, user.dbUserId);
  revalidateSyncedPaths();
  return { success: true as const, result };
}

export async function getAirbnbSyncStatusAction() {
  const user = await requirePermission("properties:read");
  const status = await getAirbnbSyncStatusForOwner(user.dbUserId);
  return { success: true as const, status };
}

export async function disconnectPropertyAirbnbIcalAction(propertyId: string) {
  const user = await requirePermission("properties:write");
  const result = await disconnectPropertyAirbnbIcal(propertyId, user.dbUserId);
  revalidateSyncedPaths();
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
