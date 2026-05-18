"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { syncAirbnbCalendarsAction } from "@/features/properties/actions/airbnb-sync.actions";
import {
  AIRBNB_AUTO_SYNC_INITIAL_MS,
  AIRBNB_AUTO_SYNC_MS,
  dispatchAirbnbSyncComplete,
} from "@/lib/airbnb-sync";

type AirbnbAutoSyncProps = {
  enabled: boolean;
};

export function AirbnbAutoSync({ enabled }: AirbnbAutoSyncProps) {
  const router = useRouter();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    async function runSync() {
      if (syncingRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      syncingRef.current = true;
      try {
        const { summary } = await syncAirbnbCalendarsAction();
        dispatchAirbnbSyncComplete({
          created: summary.created,
          updated: summary.updated,
          cancelled: summary.cancelled,
          propertiesSynced: summary.propertiesSynced,
          errors: summary.results.filter((r) => r.error).length,
        });
        router.refresh();
      } catch {
        // silencioso en auto-sync periódico
      } finally {
        syncingRef.current = false;
      }
    }

    const initial = window.setTimeout(runSync, AIRBNB_AUTO_SYNC_INITIAL_MS);
    const interval = window.setInterval(runSync, AIRBNB_AUTO_SYNC_MS);

    const onFocus = () => {
      void runSync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, router]);

  return null;
}
