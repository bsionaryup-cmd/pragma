"use server";

import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import {
  createProspect,
  setProspectArchived,
  updateProspect,
  type ProspectFormInput,
} from "@/modules/sales-console/services/prospect.service";

const PROSPECTS_PATH = "/owner-dashboard/sales/prospects";
const PIPELINE_PATH = "/owner-dashboard/sales/pipeline";

function revalidateProspects() {
  revalidatePath(PROSPECTS_PATH);
  revalidatePath(PIPELINE_PATH);
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

export async function createProspectAction(input: ProspectFormInput) {
  try {
    const owner = await requirePlatformOwnerUser();
    const prospect = await createProspect({
      ...input,
      createdById: owner.id,
    });
    revalidateProspects();
    return { success: true as const, prospect };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProspectAction(input: ProspectFormInput & { id: string }) {
  try {
    await requirePlatformOwnerUser();
    const prospect = await updateProspect(input.id, input);
    revalidateProspects();
    return { success: true as const, prospect };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveProspectAction(id: string) {
  try {
    await requirePlatformOwnerUser();
    const prospect = await setProspectArchived(id, true);
    revalidateProspects();
    return { success: true as const, prospect };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreProspectAction(id: string) {
  try {
    await requirePlatformOwnerUser();
    const prospect = await setProspectArchived(id, false);
    revalidateProspects();
    return { success: true as const, prospect };
  } catch (error) {
    return actionError(error);
  }
}
