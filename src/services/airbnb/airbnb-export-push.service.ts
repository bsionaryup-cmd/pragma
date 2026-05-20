import { icalSyncLog } from "@/lib/airbnb/ical-sync-logger";
import { db } from "@/lib/db";
import { ensurePropertyIcalExportToken } from "@/services/airbnb/ical-export.service";

/** Propiedad vinculada a Airbnb (importa o exporta calendario). */
export async function isPropertyLinkedToAirbnb(
  propertyId: string,
): Promise<boolean> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { icalUrl: true, airbnbListingUrl: true },
  });
  if (!property) return false;
  return Boolean(property.icalUrl?.trim() || property.airbnbListingUrl?.trim());
}

/**
 * Tras crear/editar/eliminar una reserva en PRAGMA, prepara el feed iCal de
 * exportación. El feed es dinámico, pero tocar la propiedad invalida vistas
 * relacionadas y deja el token listo para copiar/importar en Airbnb.
 */
export async function touchPropertyIcalExport(propertyId: string): Promise<void> {
  await ensurePropertyIcalExportToken(propertyId);

  await db.property.update({
    where: { id: propertyId },
    data: { updatedAt: new Date() },
  });

  icalSyncLog.info("export_feed_touched", { propertyId });
}

/**
 * @deprecated Usar touchPropertyIcalExport. Se conserva el alias para no romper
 * imports existentes.
 */
export const pushReservationToAirbnbCalendar = touchPropertyIcalExport;
