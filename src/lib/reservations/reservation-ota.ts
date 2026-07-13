import { BookingPlatform } from "@prisma/client";

/**
 * Reserva que no puede eliminarse en PRAGMA:
 * - cualquier canal distinto de DIRECT (Airbnb, Booking, futuros OTAs)
 * - DIRECT con UID iCal (sincronizada / exportada)
 */
export function isOtaImportedReservation(input: {
  platform: BookingPlatform;
  icalUid?: string | null;
}): boolean {
  if (input.platform !== BookingPlatform.DIRECT) return true;
  return Boolean(input.icalUid?.trim());
}

/** Solo reservas DIRECT sin UID externo. */
export function isDirectReservationDeletable(input: {
  platform: BookingPlatform;
  icalUid?: string | null;
}): boolean {
  return !isOtaImportedReservation(input);
}

export const OTA_RESERVATION_DELETE_MESSAGE =
  "Las reservas de canales externos (Airbnb, Booking, iCal) no se pueden eliminar en PRAGMA. Solo las reservas directas creadas en PRAGMA pueden eliminarse.";

export const DIRECT_RESERVATION_DELETE_CONFIRM_MESSAGE =
  "Esta acción eliminará permanentemente la reserva directa. Esta operación no puede deshacerse.";
