import "server-only";

import type { ProspectSegment, ProspectSource } from "@prisma/client";
import { db } from "@/lib/db";
import {
  parseProspectImportText,
  type ParsedProspectImportRow,
} from "@/modules/sales-console/import/prospect-import.parse";
import { buildProspectDedupKey, filterProspectsForInsert } from "@/modules/sales-console/prospecting/prospect-dedup";
import {
  bulkCreateProspects,
  type ProspectFormInput,
} from "@/modules/sales-console/services/prospect.service";

import type { ProspectImportSourcePreset } from "@/modules/sales-console/import/prospect-import.types";

const SOURCE_PRESET_MAP: Record<
  ProspectImportSourcePreset,
  { source: ProspectSource; segment: ProspectSegment }
> = {
  MANUAL: { source: "MANUAL", segment: "PROPERTY_MANAGER" },
  GOOGLE_MAPS_MANUAL: { source: "GOOGLE_MAPS", segment: "PROPERTY_MANAGER" },
  FREE_DIRECTORY: { source: "MANUAL", segment: "SHORT_TERM_OPERATOR" },
};

async function loadExistingProspectDedupKeys(): Promise<Set<string>> {
  const rows = await db.prospect.findMany({
    select: { companyName: true, city: true },
  });

  return new Set(rows.map((row) => buildProspectDedupKey(row)));
}

function mapParsedRowToInput(
  row: ParsedProspectImportRow,
  preset: ProspectImportSourcePreset,
): ProspectFormInput {
  const defaults = SOURCE_PRESET_MAP[preset];
  return {
    companyName: row.companyName,
    phone: row.phone,
    website: row.website,
    city: row.city,
    instagram: row.instagram,
    segment: defaults.segment,
    source: defaults.source,
    notes: null,
  };
}

export async function importProspectsFromText(
  rawText: string,
  createdById: string,
  preset: ProspectImportSourcePreset = "MANUAL",
): Promise<{
  imported: number;
  skippedInvalid: number;
  skippedDuplicate: number;
  skippedEmpty: number;
}> {
  const parsed = parseProspectImportText(rawText);

  if (parsed.rows.length === 0) {
    return {
      imported: 0,
      skippedInvalid: parsed.skippedInvalid,
      skippedDuplicate: 0,
      skippedEmpty: parsed.skippedEmpty,
    };
  }

  const candidates = parsed.rows.map((row) => mapParsedRowToInput(row, preset));
  const existingKeys = await loadExistingProspectDedupKeys();
  const { rows: dedupedRows, skippedDuplicate } = filterProspectsForInsert(candidates, existingKeys);
  const { imported } = await bulkCreateProspects(dedupedRows, createdById);

  return {
    imported,
    skippedInvalid: parsed.skippedInvalid,
    skippedDuplicate,
    skippedEmpty: parsed.skippedEmpty,
  };
}
