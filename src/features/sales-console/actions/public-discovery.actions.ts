"use server";

import { revalidatePath } from "next/cache";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { PUBLIC_DISCOVERY_FAILURE_MESSAGE } from "@/modules/sales-console/discovery/public-discovery.errors";
import { discoverProspectsFromPublicData } from "@/modules/sales-console/discovery/public-discovery.service";

const PROSPECTS_PATH = "/owner-dashboard/sales/prospects";
const PIPELINE_PATH = "/owner-dashboard/sales/pipeline";

function revalidateProspects() {
  revalidatePath(PROSPECTS_PATH);
  revalidatePath(PIPELINE_PATH);
}

export async function discoverPublicProspectsAction(input: {
  searchQuery: string;
  city: string;
}) {
  try {
    const owner = await requirePlatformOwnerUser();
    const searchQuery = input.searchQuery.trim();
    const city = input.city.trim();

    if (searchQuery.length < 3 && city.length < 3) {
      return {
        success: false as const,
        error: "Indica una búsqueda o ciudad de al menos 3 caracteres",
      };
    }

    const result = await discoverProspectsFromPublicData(
      searchQuery || "administración de propiedades",
      city || null,
      owner.id,
    );

    if (result.imported === 0 && result.skippedDuplicate === 0) {
      return {
        success: false as const,
        error:
          "No se encontraron empresas en datos públicos. Abre Google Maps, copia resultados e Importar.",
      };
    }

    revalidateProspects();

    return {
      success: true as const,
      imported: result.imported,
      skippedInvalid: result.skippedInvalid,
      skippedDuplicate: result.skippedDuplicate,
    };
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) {
      return { success: false as const, error: "Acceso denegado" };
    }
    if (error instanceof Error && error.message === PUBLIC_DISCOVERY_FAILURE_MESSAGE) {
      return { success: false as const, error: error.message };
    }
    return { success: false as const, error: PUBLIC_DISCOVERY_FAILURE_MESSAGE };
  }
}
