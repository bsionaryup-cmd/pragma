"use server";

import { requireAnyPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
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

export type AccessEventRow = {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
};

export async function getReservationAccessEventsAction(
  reservationId: string,
): Promise<AccessEventRow[]> {
  await requireAnyPermission("reservations:read", "calendar:read");
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, reservationId);

  const events = await db.accessEvent.findMany({
    where: { reservationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      eventType: true,
      payload: true,
      createdAt: true,
    },
  });

  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    payload: e.payload,
    createdAt: e.createdAt.toISOString(),
  }));
}

export async function markReservationActivitySeenAction(
  reservationId: string,
): Promise<void> {
  await requireAnyPermission("reservations:read", "calendar:read");
  const scope = await requireTenantDataScope();
  await markReservationActivitySeen(scope, reservationId);
}
