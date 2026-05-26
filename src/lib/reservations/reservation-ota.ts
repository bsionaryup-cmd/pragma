import { BookingPlatform } from "@prisma/client";

/** Reserva importada por OTA (Airbnb iCal u otro canal con UID externo). */
export function isOtaImportedReservation(input: {
  platform: BookingPlatform;
  icalUid?: string | null;
}): boolean {
  if (input.platform === BookingPlatform.AIRBNB) return true;
  const uid = input.icalUid?.trim();
  return Boolean(uid);
}

export const OTA_RESERVATION_DELETE_MESSAGE =
  "Las reservas sincronizadas desde Airbnb/OTA no se pueden eliminar en PRAGMA. Actualiza el calendario en Airbnb o espera la próxima sincronización.";
