"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  getAirbnbSyncStatusAction,
  syncAirbnbCalendarsAction,
} from "@/features/properties/actions/airbnb-sync.actions";
import {
  AIRBNB_AUTO_SYNC_INITIAL_MS,
  AIRBNB_AUTO_SYNC_MS,
  dispatchAirbnbSyncComplete,
  dispatchAirbnbSyncFailed,
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
        void runSync("scheduled");
      }, delayMs);
    }

    async function runSync(trigger: string) {
      if (syncingRef.current || cancelled) return;

      syncingRef.current = true;
      try {
        const { status } = await getAirbnbSyncStatusAction();
        if (status.linkedCount === 0) {
          if (process.env.NODE_ENV === "development") {
            console.info("[ical-sync:auto] skip — sin propiedades con iCal", trigger);
          }
          return;
        }

        const { summary } = await syncAirbnbCalendarsAction();

        dispatchAirbnbSyncComplete({
          created: summary.created,
          updated: summary.updated,
          cancelled: summary.cancelled,
          propertiesSynced: summary.propertiesSynced,
          errors: summary.results.filter((r) => r.error).length,
          durationMs: summary.durationMs,
        });
        router.refresh();

        if (process.env.NODE_ENV === "development") {
          console.info("[ical-sync:auto]", trigger, summary);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error al sincronizar Airbnb";
        console.error("[ical-sync:auto] failed", { trigger, message });
        dispatchAirbnbSyncFailed(message);
      } finally {
        syncingRef.current = false;
      }
    }

    function runInitialSyncOnce() {
      if (hasRunInitialSync) return;
      hasRunInitialSync = true;
      void runSync("initial");
    }

    if (AIRBNB_AUTO_SYNC_INITIAL_MS === 0) {
      runInitialSyncOnce();
    } else {
      schedule(AIRBNB_AUTO_SYNC_INITIAL_MS);
    }

    const onFocus = () => {
      void runSync("focus");
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void runSync("visible");
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    const intervalId = window.setInterval(() => {
      void runSync("interval");
    }, AIRBNB_AUTO_SYNC_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, router]);

  return null;
}
