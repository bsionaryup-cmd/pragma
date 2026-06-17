"use server";

import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { buildNovedadesReservationDetail } from "@/services/novedades/novedades-inbox.service";
import { getNovedadesUnreadSnapshot } from "@/services/reservation-events/novedades-unread.service";

export async function getNovedadesUnreadSnapshotAction() {
  await requirePermission("reservations:read");

  try {
    const snapshot = await getNovedadesUnreadSnapshot();
    return { success: true as const, ...snapshot };
  } catch {
    return { success: false as const };
  }
}

export async function getNovedadesReservationDetailAction(reservationId: string) {
  await requirePermission("reservations:read");

  try {
    const scope = await requireTenantDataScope();
    const detail = await buildNovedadesReservationDetail(scope, reservationId);
    if (!detail) {
      return { success: false as const, error: "Reserva no encontrada" };
    }
    return { success: true as const, detail };
  } catch {
    return { success: false as const, error: "No se pudo cargar la actividad" };
  }
}
