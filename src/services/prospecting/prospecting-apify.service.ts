import "server-only";

import { normalizeGoogleMapsItem } from "@/lib/apify/normalizeLead";
import { saveLeads } from "@/lib/apify/saveLead";
import type { NormalizedLead } from "@/lib/apify/types";
import {
  fetchApifyDatasetItems,
  getApifyActorRun,
  startGoogleMapsProspectingRun,
  type ApifyRunStatus,
} from "@/modules/sales-console/prospecting/apify-prospecting.client";

const TERMINAL_FAILURE_STATUSES: ApifyRunStatus[] = ["FAILED", "ABORTED", "TIMED-OUT"];
const DEFAULT_SEARCH_LIMIT = 50;

type ApifyPlaceItem = Record<string, unknown>;

export async function startTenantProspectingSearch(
  query: string,
): Promise<{ runId: string }> {
  const searchQuery = query.trim();
  if (searchQuery.length < 2) {
    throw new Error("La consulta de búsqueda es demasiado corta");
  }
  if (searchQuery.length > 200) {
    throw new Error("La consulta de búsqueda es demasiado larga");
  }

  return startGoogleMapsProspectingRun({
    searchQuery,
    limit: DEFAULT_SEARCH_LIMIT,
  });
}

export async function importTenantProspectingRun(
  organizationId: string,
  runId: string,
): Promise<
  | { phase: "RUNNING" }
  | { phase: "FAILED"; error: string }
  | { phase: "SUCCEEDED"; inserted: number; skipped: number; skippedInvalid: number }
> {
  const trimmedRunId = runId.trim();
  if (!trimmedRunId) {
    return { phase: "FAILED", error: "Se requiere el id de ejecución" };
  }

  const run = await getApifyActorRun(trimmedRunId);

  if (run.status === "READY" || run.status === "RUNNING") {
    return { phase: "RUNNING" };
  }

  if (TERMINAL_FAILURE_STATUSES.includes(run.status)) {
    return {
      phase: "FAILED",
      error: run.errorMessage ?? "La ejecución de Apify falló",
    };
  }

  if (!run.defaultDatasetId) {
    return { phase: "FAILED", error: "La ejecución de Apify terminó sin dataset" };
  }

  const items = await fetchApifyDatasetItems<ApifyPlaceItem>(run.defaultDatasetId);
  const leads: NormalizedLead[] = [];
  let skippedInvalid = 0;

  for (const item of items) {
    const normalized = normalizeGoogleMapsItem(item);
    if (!normalized) {
      skippedInvalid += 1;
      continue;
    }
    leads.push(normalized);
  }

  const { inserted, skipped } = await saveLeads(organizationId, leads);
  return { phase: "SUCCEEDED", inserted, skipped, skippedInvalid };
}
