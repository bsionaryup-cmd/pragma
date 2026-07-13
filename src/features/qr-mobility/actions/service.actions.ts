"use server";

import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import {
  createMobilityService,
  deactivateMobilityService,
  softDeleteMobilityService,
  updateMobilityService,
  type MobilityServiceFormInput,
} from "@/modules/qr-mobility/services/mobility-service.service";

const MOBILITY_BASE = "/owner-dashboard/qr-mobility";
const SERVICES_PATH = `${MOBILITY_BASE}/servicios`;

function revalidateServices() {
  revalidatePath(MOBILITY_BASE);
  revalidatePath(SERVICES_PATH);
}

function actionError(error: unknown) {
  if (error instanceof PlatformOwnerForbiddenError) {
    return { success: false as const, error: "Acceso denegado" };
  }
  if (error instanceof Error) {
    return { success: false as const, error: error.message };
  }
  return { success: false as const, error: "Error inesperado" };
}

export async function createMobilityServiceAction(input: MobilityServiceFormInput) {
  try {
    const owner = await requirePlatformOwnerUser();
    const service = await createMobilityService(
      { ...input, createdById: owner.id },
      owner,
    );
    revalidateServices();
    return { success: true as const, service };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateMobilityServiceAction(
  input: MobilityServiceFormInput & { id: string },
) {
  try {
    const owner = await requirePlatformOwnerUser();
    const service = await updateMobilityService(input.id, input, owner);
    revalidateServices();
    return { success: true as const, service };
  } catch (error) {
    return actionError(error);
  }
}

export async function deactivateMobilityServiceAction(id: string) {
  try {
    const owner = await requirePlatformOwnerUser();
    const service = await deactivateMobilityService(id, owner);
    revalidateServices();
    return { success: true as const, service };
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteMobilityServiceAction(id: string) {
  try {
    const owner = await requirePlatformOwnerUser();
    const service = await softDeleteMobilityService(id, owner);
    revalidateServices();
    return { success: true as const, service };
  } catch (error) {
    return actionError(error);
  }
}
