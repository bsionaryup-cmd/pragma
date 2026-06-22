import "server-only";

import { PUBLIC_DISCOVERY_FAILURE_MESSAGE } from "@/modules/sales-console/discovery/public-discovery.errors";

const NOMINATIM_ORIGIN = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT = "PRAGMA-PMS-SalesConsole/1.0 (contact: hola@pragmapms.com)";
const NOMINATIM_TIMEOUT_MS = 15_000;

export type NominatimPlace = {
  name?: string;
  display_name?: string;
  class?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
};

function assertNominatimUrl(url: URL): void {
  if (url.origin !== NOMINATIM_ORIGIN) {
    throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
  }
}

export async function searchOpenStreetMapPlaces(
  query: string,
  limit: number,
): Promise<NominatimPlace[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const url = new URL(`${NOMINATIM_ORIGIN}/search`);
  url.searchParams.set("q", trimmedQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "co");
  url.searchParams.set("limit", String(Math.min(50, Math.max(1, limit))));

  assertNominatimUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.filter(
      (item): item is NominatimPlace =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  } catch (error) {
    if (error instanceof Error && error.message === PUBLIC_DISCOVERY_FAILURE_MESSAGE) {
      throw error;
    }
    throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
  } finally {
    clearTimeout(timeoutId);
  }
}
