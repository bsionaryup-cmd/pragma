"use server";

import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import {
  isApifyProspectingConfigured,
  startGoogleMapsProspectingRun,
} from "@/modules/sales-console/prospecting/apify-prospecting.client";
import { importProspectsFromApifyRun } from "@/modules/sales-console/prospecting/prospect-generation.service";
import type {
  ImportGeneratedProspectsResult,
  StartProspectGenerationResult,
} from "@/modules/sales-console/prospecting/prospect-generation.types";

const PROSPECTS_PATH = "/owner-dashboard/sales/prospects";
const PIPELINE_PATH = "/owner-dashboard/sales/pipeline";
const ALLOWED_LIMITS = new Set([25, 50, 100]);

function revalidateProspects() {
  revalidatePath(PROSPECTS_PATH);
  revalidatePath(PIPELINE_PATH);
}

function actionError(error: unknown): { success: false; error: string } {
  if (error instanceof PlatformOwnerForbiddenError) {
    return { success: false, error: "Acceso denegado" };
  }
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "Error inesperado" };
}

export async function startProspectGenerationAction(input: {
  searchQuery: string;
  limit: number;
}): Promise<StartProspectGenerationResult> {
  try {
    await requirePlatformOwnerUser();

    if (!isApifyProspectingConfigured()) {
      return {
        success: false,
        error:
          "Configura APIFY_API_TOKEN para habilitar la generación automática de prospectos.",
      };
    }

    const searchQuery = input.searchQuery.trim();
    if (searchQuery.length < 3) {
      return { success: false, error: "La consulta de búsqueda es demasiado corta" };
    }
    if (searchQuery.length > 200) {
      return { success: false, error: "La consulta de búsqueda es demasiado larga" };
    }

    const limit = Math.floor(input.limit);
    if (!ALLOWED_LIMITS.has(limit)) {
      return { success: false, error: "El límite debe ser 25, 50 o 100" };
    }

    const { runId } = await startGoogleMapsProspectingRun({ searchQuery, limit });
    return { success: true, runId };
  } catch (error) {
    return actionError(error);
  }
}

export async function importGeneratedProspectsAction(
  runId: string,
): Promise<ImportGeneratedProspectsResult> {
  try {
    const owner = await requirePlatformOwnerUser();
    const trimmedRunId = runId.trim();

    if (!trimmedRunId) {
      return { success: false, status: "FAILED", error: "Se requiere el id de ejecución" };
    }

    const result = await importProspectsFromApifyRun(trimmedRunId, owner.id);

    if (result.phase === "RUNNING") {
      return { success: true, status: "RUNNING" };
    }

    if (result.phase === "FAILED") {
      return { success: false, status: "FAILED", error: result.error };
    }

    revalidateProspects();
    return {
      success: true,
      status: "SUCCEEDED",
      imported: result.imported,
      skippedInvalid: result.skippedInvalid,
      skippedDuplicate: result.skippedDuplicate,
    };
  } catch (error) {
    const message = actionError(error).error;
    return { success: false, status: "FAILED", error: message };
  }
}
