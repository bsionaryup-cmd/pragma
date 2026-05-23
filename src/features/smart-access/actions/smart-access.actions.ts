"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
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

export async function generateAccessCodeAction(reservationId: string) {
  await requirePermission("access:manage");
  const result = await generateAccessCodeForReservation(reservationId, {
    force: true,
  });
  revalidateSmartAccess();
  return result;
}

export async function approveAccessCodeAction(credentialId: string) {
  await requirePermission("access:manage");
  const result = await approvePendingAccessCode(credentialId);
  revalidateSmartAccess();
  return result;
}

export async function revokeAccessCodeAction(reservationId: string) {
  await requirePermission("access:manage");
  const result = await revokeAccessCodeForReservation(reservationId);
  revalidateSmartAccess();
  return result;
}

export async function suspendAccessCodeAction(reservationId: string) {
  await requirePermission("access:manage");
  const result = await suspendAccessCodeForReservation(reservationId);
  revalidateSmartAccess();
  return result;
}

export async function activateAccessCodeAction(reservationId: string) {
  await requirePermission("access:manage");
  const result = await activateAccessCodeForReservation(reservationId);
  revalidateSmartAccess();
  return result;
}
