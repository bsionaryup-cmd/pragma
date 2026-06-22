import "server-only";

import { db } from "@/lib/db";
import {
  fetchApifyDatasetItems,
  getApifyActorRun,
  type ApifyRunStatus,
} from "@/modules/sales-console/prospecting/apify-prospecting.client";
import { buildProspectDedupKey, filterProspectsForInsert } from "@/modules/sales-console/prospecting/prospect-dedup";
import {
  bulkCreateProspects,
  type ProspectFormInput,
} from "@/modules/sales-console/services/prospect.service";

type ApifyPlaceItem = Record<string, unknown>;

const TERMINAL_FAILURE_STATUSES: ApifyRunStatus[] = ["FAILED", "ABORTED", "TIMED-OUT"];

async function loadExistingProspectDedupKeys(): Promise<Set<string>> {
  const rows = await db.prospect.findMany({
    select: { companyName: true, city: true },
  });

  return new Set(rows.map((row) => buildProspectDedupKey(row)));
}

function pickString(item: ApifyPlaceItem, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function isRunnableProspectRow(input: ProspectFormInput): boolean {
  const name = input.companyName.trim();
  return name.length > 0 && name.length <= 200;
}

export function mapApifyPlaceToProspectInput(item: ApifyPlaceItem): ProspectFormInput | null {
  const companyName = pickString(item, ["title", "name"]);
  if (!companyName) return null;

  const mapped: ProspectFormInput = {
    companyName,
    phone: pickString(item, ["phone", "phoneUnformatted"]),
    website: pickString(item, ["website"]),
    instagram: null,
    city: pickString(item, ["city", "location"]),
    segment: "PROPERTY_MANAGER",
    source: "GOOGLE_MAPS",
    notes: null,
  };

  return isRunnableProspectRow(mapped) ? mapped : null;
}

export async function importProspectsFromApifyRun(
  runId: string,
  createdById: string,
): Promise<
  | { phase: "RUNNING" }
  | { phase: "FAILED"; error: string }
  | { phase: "SUCCEEDED"; imported: number; skippedInvalid: number; skippedDuplicate: number }
> {
  const run = await getApifyActorRun(runId);

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
  const rows: ProspectFormInput[] = [];
  let skippedInvalid = 0;

  for (const item of items) {
    const mapped = mapApifyPlaceToProspectInput(item);
    if (!mapped) {
      skippedInvalid += 1;
      continue;
    }
    rows.push(mapped);
  }

  const existingKeys = await loadExistingProspectDedupKeys();
  const { rows: dedupedRows, skippedDuplicate } = filterProspectsForInsert(rows, existingKeys);
  const { imported } = await bulkCreateProspects(dedupedRows, createdById);
  return { phase: "SUCCEEDED", imported, skippedInvalid, skippedDuplicate };
}
