import { BookingPlatform, ReservationStatus } from "@prisma/client";
import { hasActiveAirbnbIcalImport } from "@/lib/airbnb/ical-sync-utils";
import { icalSyncLog } from "@/lib/airbnb/ical-sync-logger";
import { db } from "@/lib/db";

export type DisconnectAirbnbIcalResult = {
  propertyId: string;
  propertyName: string;
  cancelledReservations: number;
  wasConnected: boolean;
};

/**
 * Desconecta importación Airbnb: quita icalUrl y cancela reservas importadas
 * (con icalUid). No toca reservas Directo/Booking ni export iCal saliente.
 */
export async function disconnectPropertyAirbnbIcal(
  propertyId: string,
  ownerId: string,
): Promise<DisconnectAirbnbIcalResult> {
  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId },
    select: { id: true, name: true, icalUrl: true },
  });

  if (!property) {
    throw new Error("Propiedad no encontrada");
  }

  const wasConnected = hasActiveAirbnbIcalImport(property.icalUrl);

  icalSyncLog.info("property_ical_disconnect_start", {
    propertyId,
    propertyName: property.name,
    wasConnected,
  });

  const cancelResult = await db.reservation.updateMany({
    where: {
      propertyId: property.id,
      platform: BookingPlatform.AIRBNB,
      icalUid: { not: null },
      status: { not: ReservationStatus.CANCELLED },
    },
    data: { status: ReservationStatus.CANCELLED },
  });

  await db.property.update({
    where: { id: property.id },
    data: {
      icalUrl: null,
      lastIcalSyncedAt: null,
    },
  });

  icalSyncLog.info("property_ical_disconnect_done", {
    propertyId,
    propertyName: property.name,
    cancelledReservations: cancelResult.count,
  });

  return {
    propertyId: property.id,
    propertyName: property.name,
    cancelledReservations: cancelResult.count,
    wasConnected,
  };
}
