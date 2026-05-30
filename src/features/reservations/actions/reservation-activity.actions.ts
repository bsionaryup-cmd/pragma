"use server";

import { requireAnyPermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  listReservationActivityForReservation,
  type ReservationActivityRow,
} from "@/services/reservation-activity/reservation-activity-list.service";
import { markReservationActivitySeen } from "@/services/reservation-activity/reservation-activity-unread.service";

export async function getReservationActivityAction(
  reservationId: string,
): Promise<ReservationActivityRow[]> {
  await requireAnyPermission("reservations:read", "calendar:read");
  const scope = await requireTenantDataScope();
  return listReservationActivityForReservation(scope, reservationId);
}

export async function markReservationActivitySeenAction(
  reservationId: string,
): Promise<void> {
  await requireAnyPermission("reservations:read", "calendar:read");
  const scope = await requireTenantDataScope();
  await markReservationActivitySeen(scope, reservationId);
}
