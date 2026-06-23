import "server-only";

import {
  getApifyClient,
  resolveGoogleMapsActorId,
} from "@/lib/apify/apify-client";

const DEFAULT_SEARCH_LIMIT = 50;

export async function startGoogleMapsSearch(
  searchTerm: string,
): Promise<{ runId: string }> {
  const query = searchTerm.trim();
  if (!query) {
    throw new Error("La consulta de búsqueda es obligatoria");
  }

  const client = getApifyClient();
  const actorId = resolveGoogleMapsActorId();

  const run = await client.actor(actorId).start({
    searchStringsArray: [query],
    maxCrawledPlacesPerSearch: DEFAULT_SEARCH_LIMIT,
    language: "es",
    maxImages: 0,
    includeWebResults: false,
  });

  const runId = run.id?.trim();
  if (!runId) {
    throw new Error("Apify no devolvió un id de ejecución");
  }

  return { runId };
}
