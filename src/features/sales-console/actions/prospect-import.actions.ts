"use server";

import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { IMPORT_FAILURE_MESSAGE } from "@/modules/sales-console/import/prospect-import.errors";
import type { ProspectImportSourcePreset } from "@/modules/sales-console/import/prospect-import.types";
import { importProspectsFromText } from "@/modules/sales-console/import/prospect-import.service";
import { PROSPECT_IMPORT_MAX_ROWS } from "@/modules/sales-console/import/prospect-import.parse";

const PROSPECTS_PATH = "/owner-dashboard/sales/prospects";
const PIPELINE_PATH = "/owner-dashboard/sales/pipeline";
const MAX_IMPORT_TEXT_LENGTH = 512_000;

function revalidateProspects() {
  revalidatePath(PROSPECTS_PATH);
  revalidatePath(PIPELINE_PATH);
}

export async function importProspectsAction(input: {
  text: string;
  sourcePreset: ProspectImportSourcePreset;
}) {
  try {
    const owner = await requirePlatformOwnerUser();
    const text = input.text.trim();

    if (!text) {
      return { success: false as const, error: "Pega o sube contenido para importar" };
    }

    if (text.length > MAX_IMPORT_TEXT_LENGTH) {
      return {
        success: false as const,
        error: `El contenido supera el límite de importación (${MAX_IMPORT_TEXT_LENGTH} caracteres)`,
      };
    }

    const result = await importProspectsFromText(text, owner.id, input.sourcePreset);

    if (
      result.imported === 0 &&
      result.skippedInvalid === 0 &&
      result.skippedDuplicate === 0 &&
      result.skippedEmpty === 0
    ) {
      return {
        success: false as const,
        error: "No se encontraron empresas válidas para importar",
      };
    }

    if (result.imported === 0 && result.skippedDuplicate > 0 && result.skippedInvalid === 0) {
      revalidateProspects();
      return {
        success: true as const,
        imported: 0,
        skippedInvalid: 0,
        skippedDuplicate: result.skippedDuplicate,
        skippedEmpty: result.skippedEmpty,
        maxRows: PROSPECT_IMPORT_MAX_ROWS,
      };
    }

    if (result.imported === 0) {
      return {
        success: false as const,
        error: IMPORT_FAILURE_MESSAGE,
      };
    }

    revalidateProspects();

    return {
      success: true as const,
      imported: result.imported,
      skippedInvalid: result.skippedInvalid,
      skippedDuplicate: result.skippedDuplicate,
      skippedEmpty: result.skippedEmpty,
      maxRows: PROSPECT_IMPORT_MAX_ROWS,
    };
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) {
      return { success: false as const, error: "Acceso denegado" };
    }
    if (error instanceof Error && error.message !== IMPORT_FAILURE_MESSAGE) {
      return { success: false as const, error: error.message };
    }
    return { success: false as const, error: IMPORT_FAILURE_MESSAGE };
  }
}
