"use server";

import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import {
  ENRICHMENT_FAILURE_MESSAGE,
  OpenAiEnrichmentError,
} from "@/modules/sales-console/enrichment/enrichment.errors";
import { enrichProspect } from "@/modules/sales-console/enrichment/prospect-enrich.service";

const PROSPECTS_PATH = "/owner-dashboard/sales/prospects";
const PIPELINE_PATH = "/owner-dashboard/sales/pipeline";

function revalidateProspects() {
  revalidatePath(PROSPECTS_PATH);
  revalidatePath(PIPELINE_PATH);
}

export async function enrichProspectAction(prospectId: string) {
  try {
    await requirePlatformOwnerUser();
    const result = await enrichProspect(prospectId);
    revalidateProspects();
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) {
      return { success: false as const, error: "Acceso denegado" };
    }
    if (error instanceof Error && error.message === "Prospecto no encontrado") {
      return { success: false as const, error: error.message };
    }
    if (error instanceof Error && error.message === "No se puede enriquecer un prospecto archivado") {
      return { success: false as const, error: error.message };
    }
    if (error instanceof OpenAiEnrichmentError) {
      return { success: false as const, error: ENRICHMENT_FAILURE_MESSAGE };
    }
    return { success: false as const, error: ENRICHMENT_FAILURE_MESSAGE };
  }
}
