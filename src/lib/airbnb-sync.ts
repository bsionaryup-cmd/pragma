/** Auto-sync Airbnb → PRAGMA: primera ejecución inmediata. */
export const AIRBNB_AUTO_SYNC_INITIAL_MS = 0;

/** Sondeo periódico estable para múltiples propiedades (evita saturar Server Actions). */
export const AIRBNB_AUTO_SYNC_MS = 90_000;

export const AIRBNB_SYNC_COMPLETE_EVENT = "pragma-airbnb-sync-complete";

export type AirbnbSyncCompleteDetail = {
  at: string;
  created: number;
  updated: number;
  cancelled: number;
  propertiesSynced: number;
  errors: number;
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
