"use server";

import { requirePermission } from "@/lib/auth";
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
