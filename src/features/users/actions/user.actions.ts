"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import {
  setUserActive,
  updateUserRole,
} from "@/services/users/user.service";

export async function updateUserRoleAction(userId: string, role: UserRole) {
  const current = await requirePermission("users:write");

  if (userId === current.dbUserId && role !== UserRole.ADMIN) {
    throw new Error("No puedes quitarte el rol de administrador");
  }

  await updateUserRole(userId, role);
  revalidatePath("/users");
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  const current = await requirePermission("users:write");

  if (userId === current.dbUserId && !isActive) {
    throw new Error("No puedes desactivar tu propia cuenta");
  }

  await setUserActive(userId, isActive);
  revalidatePath("/users");
}
