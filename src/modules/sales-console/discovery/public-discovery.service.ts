import "server-only";

import { db } from "@/lib/db";
import {
  PUBLIC_DISCOVERY_FAILURE_MESSAGE,
  PUBLIC_DISCOVERY_MAX_RESULTS,
} from "@/modules/sales-console/discovery/public-discovery.errors";
import {
  searchOpenStreetMapPlaces,
  type NominatimPlace,
} from "@/modules/sales-console/discovery/nominatim.client";
import { buildProspectDedupKey, filterProspectsForInsert } from "@/modules/sales-console/prospecting/prospect-dedup";
import {
  bulkCreateProspects,
  type ProspectFormInput,
} from "@/modules/sales-console/services/prospect.service";

const MAX_COMPANY_NAME_LENGTH = 200;

async function loadExistingProspectDedupKeys(): Promise<Set<string>> {
  const rows = await db.prospect.findMany({
    select: { companyName: true, city: true },
  });

  return new Set(rows.map((row) => buildProspectDedupKey(row)));
}

function resolveCity(place: NominatimPlace, fallbackCity: string | null): string | null {
  const address = place.address;
  const resolved =
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    fallbackCity;
  return resolved?.trim() || null;
}

function resolveCompanyName(place: NominatimPlace): string | null {
  const candidate = (place.name ?? place.display_name?.split(",")[0] ?? "").trim();
  if (!candidate || candidate.length > MAX_COMPANY_NAME_LENGTH) {
    return null;
  }
  return candidate;
}

function mapPlaceToProspectInput(
  place: NominatimPlace,
  fallbackCity: string | null,
): ProspectFormInput | null {
  const companyName = resolveCompanyName(place);
  if (!companyName) return null;

  return {
    companyName,
    phone: null,
    website: null,
    instagram: null,
    city: resolveCity(place, fallbackCity),
    segment: "PROPERTY_MANAGER",
    source: "MANUAL",
    notes: null,
  };
}

export async function discoverProspectsFromPublicData(
  searchQuery: string,
  city: string | null,
  createdById: string,
  limit: number = PUBLIC_DISCOVERY_MAX_RESULTS,
): Promise<{
  imported: number;
  skippedInvalid: number;
  skippedDuplicate: number;
}> {
  try {
    const cityPart = city?.trim() ?? "";
    const queryParts = [searchQuery.trim(), cityPart, "Colombia"].filter(Boolean);
    const query = queryParts.join(" ");
    const cappedLimit = Math.min(PUBLIC_DISCOVERY_MAX_RESULTS, Math.max(1, Math.floor(limit)));

    const places = await searchOpenStreetMapPlaces(query, cappedLimit);
    const candidates: ProspectFormInput[] = [];
    let skippedInvalid = 0;

    for (const place of places) {
      const mapped = mapPlaceToProspectInput(place, cityPart || null);
      if (!mapped) {
        skippedInvalid += 1;
        continue;
      }
      candidates.push(mapped);
    }

    if (candidates.length === 0) {
      return { imported: 0, skippedInvalid, skippedDuplicate: 0 };
    }

    const existingKeys = await loadExistingProspectDedupKeys();
    const { rows: dedupedRows, skippedDuplicate } = filterProspectsForInsert(
      candidates,
      existingKeys,
    );
    const { imported } = await bulkCreateProspects(dedupedRows, createdById);

    return { imported, skippedInvalid, skippedDuplicate };
  } catch {
    throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
  }
}
