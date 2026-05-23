"use server";

import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { mergeReservationScope } from "@/lib/platform/tenant-data-scope";

export async function getDashboardSyncVersionAction() {
  await requirePermission("dashboard:read");
  const scope = await requireTenantDataScope();
  const reservationWhere = mergeReservationScope(scope, {});

  const [
    reservationAgg,
    guestAgg,
    tokenAgg,
    credentialAgg,
  ] = await Promise.all([
    db.reservation.aggregate({
      where: reservationWhere,
      _max: { updatedAt: true },
      _count: { id: true },
    }),
    db.reservationGuest.aggregate({
      where: { reservation: reservationWhere },
      _max: { updatedAt: true },
      _count: { id: true },
    }),
    db.guestRegistrationToken.aggregate({
      where: { reservation: reservationWhere },
      _max: { updatedAt: true },
      _count: { id: true },
    }),
    db.accessCredential.aggregate({
      where: { reservation: reservationWhere },
      _max: { updatedAt: true },
      _count: { id: true },
    }),
  ]);

  const version = [
    reservationAgg._max.updatedAt?.getTime() ?? 0,
    reservationAgg._count.id,
    guestAgg._max.updatedAt?.getTime() ?? 0,
    guestAgg._count.id,
    tokenAgg._max.updatedAt?.getTime() ?? 0,
    tokenAgg._count.id,
    credentialAgg._max.updatedAt?.getTime() ?? 0,
    credentialAgg._count.id,
  ].join(":");

  return { success: true as const, version };
}
