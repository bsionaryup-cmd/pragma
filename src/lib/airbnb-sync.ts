/** Auto-sync Airbnb → PRAGMA: primera ejecución inmediata. */
export const AIRBNB_AUTO_SYNC_INITIAL_MS = 0;

/** Sondeo periódico en dashboard abierto (60s). */
export const AIRBNB_AUTO_SYNC_MS = 60_000;

/** Mínimo entre auto-syncs disparados por focus/visible/interval (evita tormentas). */
export const AIRBNB_AUTO_SYNC_COOLDOWN_MS = 45_000;

export const AIRBNB_SYNC_COMPLETE_EVENT = "pragma-airbnb-sync-complete";
export const AIRBNB_SYNC_FAILED_EVENT = "pragma-airbnb-sync-failed";

export type AirbnbSyncCompleteDetail = {
  at: string;
  created: number;
  updated: number;
  cancelled: number;
  propertiesSynced: number;
  errors: number;
  durationMs?: number;
};

export type AirbnbSyncFailedDetail = {
  at: string;
  message: string;
};

export function dispatchAirbnbSyncComplete(
  detail: Omit<AirbnbSyncCompleteDetail, "at">,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AirbnbSyncCompleteDetail>(AIRBNB_SYNC_COMPLETE_EVENT, {
      detail: { ...detail, at: new Date().toISOString() },
    }),
  );
}

export function dispatchAirbnbSyncFailed(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AirbnbSyncFailedDetail>(AIRBNB_SYNC_FAILED_EVENT, {
      detail: { at: new Date().toISOString(), message },
    }),
  );
}
