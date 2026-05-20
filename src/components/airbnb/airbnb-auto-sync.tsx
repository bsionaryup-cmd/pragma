"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { syncAirbnbCalendarsAction } from "@/features/properties/actions/airbnb-sync.actions";
import {
  AIRBNB_AUTO_SYNC_INITIAL_MS,
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

    let cancelled = false;
    let timerId: number | undefined;
    let hasRunInitialSync = false;

    function schedule(delayMs: number) {
      if (cancelled) return;
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        void runSync();
      }, delayMs);
    }

    async function runSync() {
      if (syncingRef.current || cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }

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
        // Auto-sync no debe romper la navegación ni saturar Server Actions.
      } finally {
        syncingRef.current = false;
      }
    }

    function runInitialSyncOnce() {
      if (hasRunInitialSync) return;
      hasRunInitialSync = true;
      void runSync();
    }

    if (AIRBNB_AUTO_SYNC_INITIAL_MS === 0) {
      runInitialSyncOnce();
    } else {
      schedule(AIRBNB_AUTO_SYNC_INITIAL_MS);
    }

    const onFocus = () => {
      void runSync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void runSync();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, router]);

  return null;
}
