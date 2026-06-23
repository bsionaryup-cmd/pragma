import "server-only";

import {
  getApifyClient,
  resolveGoogleMapsActorId,
} from "@/lib/apify/apify-client";
import { normalizeGoogleMapsItem } from "@/lib/apify/normalizeLead";
import type { NormalizedLead } from "@/lib/apify/types";

const DEFAULT_SEARCH_LIMIT = 50;

export async function scrapeGoogleMaps(searchTerm: string): Promise<NormalizedLead[]> {
  const query = searchTerm.trim();
  if (!query) {
    throw new Error("La consulta de búsqueda es obligatoria");
  }

  const client = getApifyClient();
  const actorId = resolveGoogleMapsActorId();

  const run = await client.actor(actorId).call(
    {
      searchStringsArray: [query],
      maxCrawledPlacesPerSearch: DEFAULT_SEARCH_LIMIT,
      language: "es",
      maxImages: 0,
      includeWebResults: false,
    },
    { waitSecs: 120 },
  );

  const datasetId = run.defaultDatasetId;
  if (!datasetId) {
    throw new Error("Apify no devolvió un dataset para la búsqueda");
  }

  const { items } = await client.dataset(datasetId).listItems();
  const leads: NormalizedLead[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const normalized = normalizeGoogleMapsItem(item as Record<string, unknown>);
    if (normalized) leads.push(normalized);
  }

  return leads;
}
