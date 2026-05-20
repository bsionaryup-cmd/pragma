import { BookingPlatform, ReservationStatus } from "@prisma/client";
import { hasActiveAirbnbIcalImport } from "@/lib/airbnb/ical-sync-utils";
import { icalSyncLog } from "@/lib/airbnb/ical-sync-logger";
import { db } from "@/lib/db";

/** Reserva/bloqueo Airbnb que no debe existir si la propiedad no tiene iCal activo. */
export function isOrphanAirbnbReservation(input: {
  icalUid: string | null;
  platform: BookingPlatform;
}): boolean {
  return Boolean(input.icalUid) || input.platform === BookingPlatform.AIRBNB;
}

/**
 * Archiva imports Airbnb huérfanos (solo si la propiedad NO tiene iCal activo).
 * No toca Directo/Booking (platform distinto, icalUid null).
 */
export async function archiveOrphanAirbnbImportsForProperty(
  propertyId: string,
  icalUrl: string | null | undefined,
): Promise<number> {
  if (hasActiveAirbnbIcalImport(icalUrl)) return 0;

  const result = await db.reservation.updateMany({
    where: {
      propertyId,
      status: { not: ReservationStatus.CANCELLED },
      OR: [
        { icalUid: { not: null } },
        { platform: BookingPlatform.AIRBNB },
      ],
    },
    data: { status: ReservationStatus.CANCELLED },
  });

  if (result.count > 0) {
    icalSyncLog.info("orphan_airbnb_archived", {
      propertyId,
      count: result.count,
    });
  }

  return result.count;
}

/** Normaliza icalUrl vacío/solo espacios → null (evita “conectado fantasma” en Prisma). */
export async function sanitizeInactivePropertyIcalUrl(
  propertyId: string,
  icalUrl: string | null | undefined,
): Promise<void> {
  if (icalUrl == null) return;
  if (hasActiveAirbnbIcalImport(icalUrl)) return;

  await db.property.update({
    where: { id: propertyId },
    data: { icalUrl: null, lastIcalSyncedAt: null },
  });

  icalSyncLog.info("property_ical_url_sanitized", { propertyId });
}

/** Sin iCal activo: sanitiza URL y archiva imports Airbnb huérfanos. */
export async function enforcePropertyAirbnbIcalIsolation(
  propertyId: string,
  icalUrl: string | null | undefined,
): Promise<number> {
  if (hasActiveAirbnbIcalImport(icalUrl)) return 0;
  await sanitizeInactivePropertyIcalUrl(propertyId, icalUrl);
  return archiveOrphanAirbnbImportsForProperty(propertyId, null);
}

/** Aísla todas las propiedades del owner sin iCal (801/802/803/804 por propertyId). */
export async function enforceOwnerDisconnectedAirbnbImports(
  ownerId: string,
): Promise<number> {
  const properties = await db.property.findMany({
    where: { ownerId },
    select: { id: true, icalUrl: true },
  });

  let archived = 0;
  for (const property of properties) {
    archived += await enforcePropertyAirbnbIcalIsolation(
      property.id,
      property.icalUrl,
    );
  }
  return archived;
}
