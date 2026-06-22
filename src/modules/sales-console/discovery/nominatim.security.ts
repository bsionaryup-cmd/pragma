import { PUBLIC_DISCOVERY_FAILURE_MESSAGE } from "@/modules/sales-console/discovery/public-discovery.errors";

export const NOMINATIM_ALLOWED_HOST = "nominatim.openstreetmap.org";
export const NOMINATIM_ALLOWED_ORIGIN = `https://${NOMINATIM_ALLOWED_HOST}`;
export const NOMINATIM_SEARCH_PATH = "/search";
export const NOMINATIM_TIMEOUT_MS = 15_000;
export const NOMINATIM_MIN_INTERVAL_MS = 2_000;
export const NOMINATIM_MAX_RESULTS = 25;

let lastNominatimRequestAt = 0;

export async function waitForNominatimRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((resolve) => {
      setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed);
    });
  }
  lastNominatimRequestAt = Date.now();
}

export function assertNominatimRequestUrl(url: URL): void {
  if (url.protocol !== "https:") {
    throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
  }
  if (url.hostname !== NOMINATIM_ALLOWED_HOST) {
    throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
  }
  if (url.username || url.password) {
    throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
  }
  if (!url.pathname.startsWith(NOMINATIM_SEARCH_PATH)) {
    throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
  }
}

export function buildNominatimSearchUrl(query: string, limit: number): URL {
  const cappedLimit = Math.min(NOMINATIM_MAX_RESULTS, Math.max(1, Math.floor(limit)));
  const url = new URL(`${NOMINATIM_ALLOWED_ORIGIN}${NOMINATIM_SEARCH_PATH}`);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "co");
  url.searchParams.set("limit", String(cappedLimit));
  assertNominatimRequestUrl(url);
  return url;
}
