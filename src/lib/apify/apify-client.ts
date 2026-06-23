import "server-only";

import { ApifyClient } from "apify-client";

let cachedClient: ApifyClient | null = null;

export function resolveApifyToken(): string | null {
  return (
    process.env.APIFY_TOKEN?.trim() ||
    process.env.APIFY_API_TOKEN?.trim() ||
    null
  );
}

export function isApifyConfigured(): boolean {
  return Boolean(resolveApifyToken());
}

export function resolveGoogleMapsActorId(): string {
  const raw =
    process.env.APIFY_GOOGLE_MAPS_ACTOR?.trim() ||
    process.env.APIFY_GOOGLE_MAPS_ACTOR_ID?.trim();

  if (!raw) return "compass/crawler-google-places";
  return raw.includes("~") ? raw.replace(/~/g, "/") : raw;
}

export function getApifyClient(): ApifyClient {
  const token = resolveApifyToken();
  if (!token) {
    throw new Error("APIFY_TOKEN no está configurado");
  }

  if (!cachedClient) {
    cachedClient = new ApifyClient({ token });
  }

  return cachedClient;
}
