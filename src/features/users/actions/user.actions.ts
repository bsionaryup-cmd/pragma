"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import {
  createUserSchema,
  updateUserProfileSchema,
} from "@/features/users/schemas/user.schema";
import {
  assertAdminCanChangeUserRole,
  assertAdminCanManageUser,
  assertCanDeleteUser,
} from "@/services/users/account-owner.guard";
import {
  createUserByAdmin,
  deleteUserByAdmin,
  setUserActive,
  updateUserProfile,
  updateUserRole,
} from "@/services/users/user.service";

export async function createUserAction(input: unknown) {
  await requirePermission("users:write");
  const parsed = createUserSchema.parse(input);
  await createUserByAdmin({
    email: parsed.email,
    firstName: parsed.firstName || null,
    lastName: parsed.lastName || null,
    role: parsed.role,
  });
  revalidatePath("/users");
}

export async function updateUserProfileAction(userId: string, input: unknown) {
  const current = await requirePermission("users:write");
  await assertAdminCanManageUser(userId, current.dbUserId, {
    allowSelfProfileEdit: true,
  });
  const parsed = updateUserProfileSchema.parse(input);
  await updateUserProfile(userId, {
    firstName: parsed.firstName || null,
    lastName: parsed.lastName || null,
  });
  revalidatePath("/users");
}

export async function deleteUserAction(userId: string) {
  const current = await requirePermission("users:delete");
  await assertCanDeleteUser(userId, current.dbUserId);
  await deleteUserByAdmin(userId);
  revalidatePath("/users");
}

export async function updateUserRoleAction(userId: string, role: UserRole) {
  const current = await requirePermission("users:write");

  if (userId === current.dbUserId && role !== UserRole.ADMIN) {
    throw new Error("No puedes quitarte el rol de administrador");
  }

  await assertAdminCanChangeUserRole(userId);
  await updateUserRole(userId, role);
  revalidatePath("/users");
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  const current = await requirePermission("users:write");

  if (userId === current.dbUserId && !isActive) {
    throw new Error("No puedes desactivar tu propia cuenta");
  }

  if (!isActive) {
    await assertAdminCanManageUser(userId, current.dbUserId);
  }

  await setUserActive(userId, isActive);
  revalidatePath("/users");
}
