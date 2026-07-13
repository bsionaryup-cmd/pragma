"use server";

import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import {
  createMobilityAlly,
  deactivateMobilityAlly,
  regenerateMobilityAllyQr,
  softDeleteMobilityAlly,
  updateMobilityAlly,
  type MobilityAllyFormInput,
} from "@/modules/qr-mobility/services/mobility-ally.service";

const MOBILITY_BASE = "/owner-dashboard/qr-mobility";
const ALLIES_PATH = `${MOBILITY_BASE}/aliados`;

function revalidateAllies() {
  revalidatePath(MOBILITY_BASE);
  revalidatePath(ALLIES_PATH);
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

export async function createMobilityAllyAction(input: MobilityAllyFormInput) {
  try {
    const owner = await requirePlatformOwnerUser();
    const ally = await createMobilityAlly(
      { ...input, createdById: owner.id },
      owner,
    );
    revalidateAllies();
    return { success: true as const, ally };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateMobilityAllyAction(
  input: MobilityAllyFormInput & { id: string },
) {
  try {
    const owner = await requirePlatformOwnerUser();
    const ally = await updateMobilityAlly(input.id, input, owner);
    revalidateAllies();
    return { success: true as const, ally };
  } catch (error) {
    return actionError(error);
  }
}

export async function deactivateMobilityAllyAction(id: string) {
  try {
    const owner = await requirePlatformOwnerUser();
    const ally = await deactivateMobilityAlly(id, owner);
    revalidateAllies();
    return { success: true as const, ally };
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteMobilityAllyAction(id: string) {
  try {
    const owner = await requirePlatformOwnerUser();
    const ally = await softDeleteMobilityAlly(id, owner);
    revalidateAllies();
    return { success: true as const, ally };
  } catch (error) {
    return actionError(error);
  }
}

export async function regenerateMobilityAllyQrAction(id: string) {
  try {
    const owner = await requirePlatformOwnerUser();
    const ally = await regenerateMobilityAllyQr(id, owner);
    revalidateAllies();
    return { success: true as const, ally };
  } catch (error) {
    return actionError(error);
  }
}
