import type { AirbnbSyncCompleteDetail } from "@/lib/airbnb-sync";

type SyncStatusResponse = {
  success: boolean;
  status: {
    linkedCount: number;
    lastSyncedAt: string | null;
  };
  error?: string;
};

type SyncRunResponse = {
  success: boolean;
  summary?: {
    propertiesSynced: number;
    created: number;
    updated: number;
    cancelled: number;
    skipped?: number;
    results: Array<{ error?: string }>;
    durationMs?: number;
  };
  error?: string;
};

type PropertySyncResponse = {
  success: boolean;
  result?: {
    propertyId: string;
    propertyName: string;
    created: number;
    updated: number;
    cancelled: number;
    skipped: number;
    error?: string;
  };
  error?: string;
};

const CLIENT_TIMEOUT_MS = 92_000;

function formatFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "La sincronización Airbnb superó el tiempo máximo. Reintenta en unos segundos.";
    }
    return error.message;
  }
  return "Error de red al sincronizar Airbnb";
}

async function postAutoSync<T>(body: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const res = await fetch("/api/airbnb/auto-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => ({}))) as T & {
      error?: string;
      success?: boolean;
    };

    if (!res.ok) {
      throw new Error(
        typeof payload === "object" && payload && "error" in payload && payload.error
          ? String(payload.error)
          : `Auto-sync HTTP ${res.status}`,
      );
    }

    return payload;
  } catch (error) {
    throw new Error(formatFetchError(error));
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchAirbnbSyncStatus() {
  return postAutoSync<SyncStatusResponse>({ phase: "status" });
}

export async function runAirbnbAutoSyncCleanup() {
  return postAutoSync<{ success: boolean }>({ phase: "cleanup" });
}

export async function runAirbnbAutoSync(): Promise<AirbnbSyncCompleteDetail> {
  const result = await postAutoSync<SyncRunResponse>({ phase: "sync" });
  if (!result.success || !result.summary) {
    throw new Error(result.error ?? "Sync Airbnb falló");
  }

  const summary = result.summary;
  return {
    at: new Date().toISOString(),
    created: summary.created,
    updated: summary.updated,
    cancelled: summary.cancelled,
    propertiesSynced: summary.propertiesSynced,
    errors: summary.results.filter((r) => r.error).length,
    durationMs: summary.durationMs,
  };
}

export async function runPropertyAirbnbSync(propertyId: string) {
  const result = await postAutoSync<PropertySyncResponse>({
    phase: "property",
    propertyId,
  });
  if (!result.success || !result.result) {
    throw new Error(result.error ?? "No se pudo sincronizar la propiedad");
  }
  return result.result;
}
