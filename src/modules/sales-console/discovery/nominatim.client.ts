import "server-only";

import { PUBLIC_DISCOVERY_FAILURE_MESSAGE } from "@/modules/sales-console/discovery/public-discovery.errors";
import {
  assertNominatimRequestUrl,
  buildNominatimSearchUrl,
  NOMINATIM_TIMEOUT_MS,
  waitForNominatimRateLimit,
} from "@/modules/sales-console/discovery/nominatim.security";

const NOMINATIM_USER_AGENT = "PRAGMA-PMS-SalesConsole/1.0 (contact: hola@pragmapms.com)";

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

function isColombiaPlace(place: NominatimPlace): boolean {
  const country = place.address?.country?.trim().toLowerCase();
  if (!country) return true;
  return country === "colombia";
}

export async function searchOpenStreetMapPlaces(
  query: string,
  limit: number,
): Promise<NominatimPlace[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  await waitForNominatimRateLimit();

  const url = buildNominatimSearchUrl(trimmedQuery, limit);
  assertNominatimRequestUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "error",
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

    return payload
      .filter(
        (item): item is NominatimPlace =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
      .filter(isColombiaPlace);
  } catch (error) {
    if (error instanceof Error && error.message === PUBLIC_DISCOVERY_FAILURE_MESSAGE) {
      throw error;
    }
    throw new Error(PUBLIC_DISCOVERY_FAILURE_MESSAGE);
  } finally {
    clearTimeout(timeoutId);
  }
}
