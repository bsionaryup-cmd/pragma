"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { getDashboardSyncVersionAction } from "@/features/dashboard/actions/dashboard-sync.actions";
import {
  canRunDashboardRefresh,
  DASHBOARD_DATA_POLL_MS,
  dispatchDashboardDataRefresh,
  isLiveDashboardPath,
  markDashboardRefresh,
  needsDashboardFullRefresh,
} from "@/lib/dashboard-refresh";

type DashboardDataRefreshProps = {
  enabled?: boolean;
};

export function DashboardDataRefresh({ enabled = true }: DashboardDataRefreshProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  const versionRef = useRef<string | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
  }, [pathname, router]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function checkForUpdates(trigger: string) {
      if (cancelled || checkingRef.current) return;
      if (document.visibilityState !== "visible") return;

      const currentPath = pathnameRef.current ?? "";
      if (!isLiveDashboardPath(currentPath)) return;

      checkingRef.current = true;
      try {
        const result = await getDashboardSyncVersionAction();
        if (!result.success || cancelled) return;

        const previous = versionRef.current;
        versionRef.current = result.version;

        if (previous === null) return;

        if (previous === result.version) return;

        if (!canRunDashboardRefresh()) return;

        markDashboardRefresh();
        if (needsDashboardFullRefresh(currentPath)) {
          routerRef.current.refresh();
        }
        dispatchDashboardDataRefresh();

        if (process.env.NODE_ENV === "development") {
          console.info("[dashboard:refresh] actualizado", trigger);
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[dashboard:refresh] check failed", error);
        }
      } finally {
        checkingRef.current = false;
      }
    }

    void checkForUpdates("mount");

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdates("visible");
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    const intervalId = window.setInterval(() => {
      void checkForUpdates("interval");
    }, DASHBOARD_DATA_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  return null;
}
