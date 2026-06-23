import "server-only";

const APIFY_API_BASE = "https://api.apify.com/v2";
const DEFAULT_GOOGLE_MAPS_ACTOR_ID = "compass~crawler-google-places";
const APIFY_REQUEST_TIMEOUT_MS = 60_000;

export type ApifyRunStatus =
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "ABORTED"
  | "TIMED-OUT";

export type ApifyActorRunSnapshot = {
  id: string;
  status: ApifyRunStatus;
  defaultDatasetId: string | null;
  errorMessage: string | null;
};

export type ApifyGoogleMapsRunInput = {
  searchQuery: string;
  limit: number;
};

type ApifyActorRunResponse = {
  data?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
    statusMessage?: string;
  };
  error?: { message?: string };
};

type ApifyDatasetItemsResponse = {
  data?: unknown[];
  error?: { message?: string };
};

function resolveApifyToken(): string {
  const token =
    process.env.APIFY_TOKEN?.trim() ||
    process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    throw new Error("APIFY_API_TOKEN no está configurado");
  }
  return token;
}

function resolveGoogleMapsActorId(): string {
  const raw =
    process.env.APIFY_GOOGLE_MAPS_ACTOR?.trim() ||
    process.env.APIFY_GOOGLE_MAPS_ACTOR_ID?.trim();
  if (!raw) return DEFAULT_GOOGLE_MAPS_ACTOR_ID;
  return raw.includes("/") ? raw.replace("/", "~") : raw;
}

function resolveApifyErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as ApifyActorRunResponse;
    const nested = record.error?.message?.trim();
    if (nested) return nested;
  }
  return fallback;
}

async function apifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = resolveApifyToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), APIFY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${APIFY_API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json()) as T & ApifyActorRunResponse;

    if (!response.ok) {
      throw new Error(resolveApifyErrorMessage(payload, `La solicitud a Apify falló (${response.status})`));
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("La solicitud a Apify expiró");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeRunStatus(value: string | undefined): ApifyRunStatus {
  switch (value) {
    case "READY":
    case "RUNNING":
    case "SUCCEEDED":
    case "FAILED":
    case "ABORTED":
    case "TIMED-OUT":
      return value;
    default:
      return "FAILED";
  }
}

export function isApifyProspectingConfigured(): boolean {
  return Boolean(
    process.env.APIFY_TOKEN?.trim() || process.env.APIFY_API_TOKEN?.trim(),
  );
}

/** Start a Google Maps actor run on Apify. Returns the run id for client polling. */
export async function startGoogleMapsProspectingRun(
  input: ApifyGoogleMapsRunInput,
): Promise<{ runId: string }> {
  const searchQuery = input.searchQuery.trim();
  if (!searchQuery) {
    throw new Error("La consulta de búsqueda es obligatoria");
  }

  const limit = Math.min(100, Math.max(1, Math.floor(input.limit)));
  const actorId = resolveGoogleMapsActorId();

  const payload = await apifyFetch<ApifyActorRunResponse>(`/acts/${actorId}/runs`, {
    method: "POST",
    body: JSON.stringify({
      searchStringsArray: [searchQuery],
      maxCrawledPlacesPerSearch: limit,
      language: "es",
      maxImages: 0,
      includeWebResults: false,
    }),
  });

  const runId = payload.data?.id?.trim();
  if (!runId) {
    throw new Error("Apify no devolvió un id de ejecución");
  }

  return { runId };
}

/** Poll actor run status until terminal states are reported by Apify. */
export async function getApifyActorRun(runId: string): Promise<ApifyActorRunSnapshot> {
  const trimmedRunId = runId.trim();
  if (!trimmedRunId) {
    throw new Error("Se requiere el id de ejecución");
  }

  const payload = await apifyFetch<ApifyActorRunResponse>(`/actor-runs/${trimmedRunId}`);

  return {
    id: payload.data?.id?.trim() ?? trimmedRunId,
    status: normalizeRunStatus(payload.data?.status),
    defaultDatasetId: payload.data?.defaultDatasetId?.trim() || null,
    errorMessage: payload.data?.statusMessage?.trim() || null,
  };
}

/** Fetch all dataset items for a completed Apify run. */
export async function fetchApifyDatasetItems<T extends Record<string, unknown> = Record<string, unknown>>(
  datasetId: string,
): Promise<T[]> {
  const trimmedDatasetId = datasetId.trim();
  if (!trimmedDatasetId) {
    throw new Error("Se requiere el id del dataset");
  }

  const token = resolveApifyToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), APIFY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${APIFY_API_BASE}/datasets/${trimmedDatasetId}/items?format=json&clean=true`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`La descarga del dataset de Apify falló (${response.status})`);
    }

    const payload: unknown = await response.json();
    const rawItems = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as ApifyDatasetItemsResponse).data)
        ? (payload as ApifyDatasetItemsResponse).data!
        : [];

    return rawItems.filter(
      (item): item is T => Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("La descarga del dataset de Apify expiró");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
