"use server";

import type { RetailAccessPlan } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import {
  createRetailAccount,
  deleteRetailAccount,
  setRetailAccountActive,
  updateRetailAccount,
} from "@/modules/retail-admin/services/retail-admin-user.service";

const USERS_PATH = "/owner-dashboard/intiendas/usuarios";
const DASHBOARD_PATH = "/owner-dashboard/intiendas";

function actionError(error: unknown) {
  if (error instanceof PlatformOwnerForbiddenError) {
    return { success: false as const, error: "Acceso denegado" };
  }
  return {
    success: false as const,
    error: error instanceof Error ? error.message : "Error inesperado",
  };
}

function refresh() {
  revalidatePath(USERS_PATH);
  revalidatePath(DASHBOARD_PATH);
}

export async function createRetailAccountAction(input: {
  businessName: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  accessPlan: RetailAccessPlan;
  billingAmount: number;
}) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const result = await createRetailAccount({ platformUser, ...input });
    refresh();
    return { success: true as const, userId: result.user.id, storeId: result.store.id };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRetailAccountAction(input: {
  userId: string;
  businessName?: string;
  firstName?: string | null;
  lastName?: string | null;
  accessPlan?: RetailAccessPlan;
  billingAmount?: number;
  password?: string;
}) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    await updateRetailAccount({ platformUser, ...input });
    refresh();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function setRetailAccountActiveAction(input: {
  userId: string;
  isActive: boolean;
}) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    await setRetailAccountActive({ platformUser, ...input });
    refresh();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteRetailAccountAction(userId: string) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    await deleteRetailAccount({ platformUser, userId });
    refresh();
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}
