/** Auto-sync Airbnb → PRAGMA: diferido para no competir con la carga inicial del dashboard. */
export const AIRBNB_AUTO_SYNC_INITIAL_MS = 25_000;

/** Sondeo periódico en dashboard abierto (90s). */
export const AIRBNB_AUTO_SYNC_MS = 90_000;

/** Mínimo entre auto-syncs disparados por visible/interval (evita tormentas). */
export const AIRBNB_AUTO_SYNC_COOLDOWN_MS = 60_000;

/** Omite sync completo si la última sync fue reciente (salvo sync manual). */
export const AIRBNB_AUTO_SYNC_RECENT_MS = 5 * 60_000;

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
