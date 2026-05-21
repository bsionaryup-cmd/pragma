import { revalidatePath } from "next/cache";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { withTimeout } from "@/lib/async-timeout";
import { hasActiveAirbnbIcalImport } from "@/lib/airbnb/ical-sync-utils";
import { enforceOwnerDisconnectedAirbnbImports } from "@/services/airbnb/airbnb-ical-orphan.service";
import {
  getAirbnbSyncStatusForOwner,
  syncAllAirbnbCalendarsForOwner,
  syncPropertyIcalCalendar,
} from "@/services/airbnb/airbnb-ical-sync.service";
import { db } from "@/lib/db";

const AIRBNB_SYNC_TIMEOUT_MS = 90_000;

function revalidateSyncedPaths() {
  revalidatePath("/properties");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function handleAirbnbSyncStatus(ownerId: string) {
  const status = await getAirbnbSyncStatusForOwner(ownerId);
  return { success: true as const, status };
}

/** Housekeeping — no billing lock (orphan archival only). */
export async function handleAirbnbSyncCleanup(ownerId: string) {
  const archived = await enforceOwnerDisconnectedAirbnbImports(ownerId);
  return { success: true as const, archived };
}

export async function handleAirbnbSyncAll(ownerId: string) {
  await assertBillingUnlocked();
  await enforceOwnerDisconnectedAirbnbImports(ownerId);

  const linked = await db.property.findMany({
    where: { ownerId },
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

  const summary = await withTimeout(
    syncAllAirbnbCalendarsForOwner(ownerId),
    AIRBNB_SYNC_TIMEOUT_MS,
    "La sincronización con Airbnb tardó demasiado. Reintenta en unos segundos.",
  );

  return { success: true as const, summary };
}

export async function handleAirbnbSyncProperty(
  ownerId: string,
  propertyId: string,
) {
  await assertBillingUnlocked();

  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId },
    select: { icalUrl: true, name: true },
  });
  if (!property) {
    throw new Error("Propiedad no encontrada");
  }
  if (!hasActiveAirbnbIcalImport(property.icalUrl)) {
    throw new Error("Esta propiedad no tiene iCal de Airbnb conectado");
  }

  const result = await syncPropertyIcalCalendar(propertyId, ownerId);
  return { success: true as const, result };
}

export async function runAirbnbSyncAllWithRevalidate(ownerId: string) {
  const payload = await handleAirbnbSyncAll(ownerId);
  revalidateSyncedPaths();
  return payload;
}

export async function runAirbnbSyncPropertyWithRevalidate(
  ownerId: string,
  propertyId: string,
) {
  const payload = await handleAirbnbSyncProperty(ownerId, propertyId);
  revalidateSyncedPaths();
  return payload;
}

export async function runAirbnbSyncCleanupWithRevalidate(ownerId: string) {
  const payload = await handleAirbnbSyncCleanup(ownerId);
  revalidateSyncedPaths();
  return payload;
}
