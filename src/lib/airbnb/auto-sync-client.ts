import type { AirbnbSyncCompleteDetail } from "@/lib/airbnb-sync";

type SyncStatusResponse = {
  success: boolean;
  status: {
    linkedCount: number;
    lastSyncedAt: string | null;
  };
};

type SyncRunResponse = {
  success: boolean;
  summary?: {
    propertiesSynced: number;
    created: number;
    updated: number;
    cancelled: number;
    results: Array<{ error?: string }>;
    durationMs?: number;
  };
  error?: string;
};

async function postAutoSync<T>(body: { phase: string }): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 95_000);

  const res = await fetch("/api/airbnb/auto-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timer));

  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    throw new Error(
      typeof payload === "object" && payload && "error" in payload && payload.error
        ? String(payload.error)
        : `Auto-sync HTTP ${res.status}`,
    );
  }

  return payload;
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
