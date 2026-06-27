"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { reservationPropertyWhere } from "@/lib/platform/tenant-data-scope";
import {
  approvePendingAccessCode,
  activateAccessCodeForReservation,
  generateAccessCodeForReservation,
  revokeAccessCodeForReservation,
  suspendAccessCodeForReservation,
} from "@/services/integrations/ttlock/ttlock-access.service";

function revalidateSmartAccess() {
  revalidatePath("/smart-access");
  revalidatePath("/reservations");
}

async function assertAccessReservationInScope(reservationId: string) {
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, reservationId);
}

export async function generateAccessCodeAction(reservationId: string) {
  await requirePermission("access:manage");
  await assertAccessReservationInScope(reservationId);
  const result = await generateAccessCodeForReservation(reservationId, {
    force: true,
  });
  revalidateSmartAccess();
  return result;
}

export async function approveAccessCodeAction(credentialId: string) {
  await requirePermission("access:manage");
  const scope = await requireTenantDataScope();
  const credential = await db.accessCredential.findFirst({
    where: {
      id: credentialId,
      reservation: reservationPropertyWhere(scope),
    },
    select: { reservationId: true },
  });
  if (!credential) {
    return { ok: false, message: "Credencial no encontrada" };
  }
  const result = await approvePendingAccessCode(credentialId);
  revalidateSmartAccess();
  return result;
}

export async function revokeAccessCodeAction(reservationId: string) {
  await requirePermission("access:manage");
  await assertAccessReservationInScope(reservationId);
  const result = await revokeAccessCodeForReservation(reservationId, { force: true });
  revalidateSmartAccess();
  return result;
}

export async function suspendAccessCodeAction(reservationId: string) {
  await requirePermission("access:manage");
  await assertAccessReservationInScope(reservationId);
  const result = await suspendAccessCodeForReservation(reservationId);
  revalidateSmartAccess();
  return result;
}

export async function activateAccessCodeAction(reservationId: string) {
  await requirePermission("access:manage");
  await assertAccessReservationInScope(reservationId);
  const result = await activateAccessCodeForReservation(reservationId);
  revalidateSmartAccess();
  return result;
}
