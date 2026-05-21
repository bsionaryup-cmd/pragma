"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  fetchAirbnbSyncStatus,
  runAirbnbAutoSync,
  runAirbnbAutoSyncCleanup,
} from "@/lib/airbnb/auto-sync-client";
import {
  AIRBNB_AUTO_SYNC_COOLDOWN_MS,
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
  const pathname = usePathname();
  const syncingRef = useRef(false);
  const lastRunAtRef = useRef(0);
  const initialDoneRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);

  useEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
  }, [pathname, router]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timerId: number | undefined;

    function shouldThrottle(trigger: string): boolean {
      if (trigger === "initial") return false;
      const elapsed = Date.now() - lastRunAtRef.current;
      return elapsed < AIRBNB_AUTO_SYNC_COOLDOWN_MS;
    }

    async function runSync(trigger: string) {
      if (syncingRef.current || cancelled) return;
      if (shouldThrottle(trigger)) return;

      syncingRef.current = true;
      lastRunAtRef.current = Date.now();

      try {
        const statusPayload = await fetchAirbnbSyncStatus();
        if (!statusPayload.success) {
          throw new Error(statusPayload.error ?? "No se pudo leer estado Airbnb");
        }

        const { status } = statusPayload;
        const currentPath = pathnameRef.current ?? "";

        if (status.linkedCount === 0) {
          await runAirbnbAutoSyncCleanup();
          if (!currentPath.startsWith("/calendar")) {
            routerRef.current.refresh();
          }
          if (process.env.NODE_ENV === "development") {
            console.info("[ical-sync:auto] skip — sin iCal; huérfanos archivados", trigger);
          }
          return;
        }

        const summary = await runAirbnbAutoSync();
        dispatchAirbnbSyncComplete(summary);

        if (!currentPath.startsWith("/calendar")) {
          routerRef.current.refresh();
        }

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

    function schedule(delayMs: number, trigger: string) {
      if (cancelled) return;
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        void runSync(trigger);
      }, delayMs);
    }

    if (!initialDoneRef.current) {
      initialDoneRef.current = true;
      if (AIRBNB_AUTO_SYNC_INITIAL_MS === 0) {
        void runSync("initial");
      } else {
        schedule(AIRBNB_AUTO_SYNC_INITIAL_MS, "initial");
      }
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
  }, [enabled]);

  return null;
}
