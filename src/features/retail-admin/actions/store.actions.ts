"use server";

import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { writeRetailAdminPlatformAudit } from "@/modules/retail-admin/services/retail-admin-audit.service";
import {
  activateRetailStore,
  createRetailStore,
  getRetailStoreDetail,
  softDeleteRetailStore,
  suspendRetailStore,
  updateRetailStore,
} from "@/modules/retail-admin/services/retail-admin-store.service";

const BASE_PATH = "/owner-dashboard/intiendas";
const STORES_PATH = `${BASE_PATH}/tiendas`;

function refresh(storeId?: string) {
  revalidatePath(BASE_PATH);
  revalidatePath(STORES_PATH);
  if (storeId) revalidatePath(`${STORES_PATH}/${storeId}`);
}

function actionError(error: unknown) {
  if (error instanceof PlatformOwnerForbiddenError) {
    return { success: false as const, error: "Acceso denegado" };
  }
  return {
    success: false as const,
    error: error instanceof Error ? error.message : "Error inesperado",
  };
}

export async function createRetailStoreAction(input: {
  organizationId: string;
  name: string;
}) {
  try {
    const owner = await requirePlatformOwnerUser();
    const store = await createRetailStore({ ...input, createdByUserId: owner.id });
    await writeRetailAdminPlatformAudit({
      platformUser: owner,
      action: "retail_store_create",
      organizationId: store.organizationId,
      newState: { id: store.id, name: store.name, status: store.status },
    });
    refresh(store.id);
    return { success: true as const, storeId: store.id };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRetailStoreAction(input: {
  id: string;
  name: string;
  currency?: string;
}) {
  try {
    const owner = await requirePlatformOwnerUser();
    const previous = await getRetailStoreDetail(input.id);
    const store = await updateRetailStore(input);
    await writeRetailAdminPlatformAudit({
      platformUser: owner,
      action: "retail_store_update",
      organizationId: store.organizationId,
      previousState: { name: previous.name, currency: previous.currency },
      newState: { name: store.name, currency: store.currency },
      metadata: { storeId: store.id },
    });
    refresh(store.id);
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

async function changeStoreStatus(
  id: string,
  action: "activate" | "suspend" | "delete",
) {
  const owner = await requirePlatformOwnerUser();
  const previous = await getRetailStoreDetail(id);
  const store =
    action === "activate"
      ? await activateRetailStore(id)
      : action === "suspend"
        ? await suspendRetailStore(id)
        : await softDeleteRetailStore(id);
  await writeRetailAdminPlatformAudit({
    platformUser: owner,
    action: `retail_store_${action}`,
    organizationId: store.organizationId,
    previousState: {
      status: previous.status,
      deletedAt: previous.deletedAt?.toISOString() ?? null,
    },
    newState: {
      status: store.status,
      deletedAt: store.deletedAt?.toISOString() ?? null,
    },
    metadata: { storeId: store.id },
  });
  refresh(store.id);
}

export async function suspendRetailStoreAction(id: string) {
  try {
    await changeStoreStatus(id, "suspend");
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function activateRetailStoreAction(id: string) {
  try {
    await changeStoreStatus(id, "activate");
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteRetailStoreAction(id: string) {
  try {
    await changeStoreStatus(id, "delete");
    return { success: true as const };
  } catch (error) {
    return actionError(error);
  }
}
