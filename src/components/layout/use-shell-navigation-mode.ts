"use client";

import { useSyncExternalStore } from "react";
import { useStandaloneDisplayMode } from "@/components/layout/use-standalone-display-mode";

const DESKTOP_NAV_MIN_WIDTH = 1280;

function subscribeDesktop(onStoreChange: () => void) {
  const query = window.matchMedia(`(min-width: ${DESKTOP_NAV_MIN_WIDTH}px)`);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function readIsDesktopViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(min-width: ${DESKTOP_NAV_MIN_WIDTH}px)`).matches;
}

export function useShellNavigationMode() {
  const isStandalone = useStandaloneDisplayMode();
  const isDesktopViewport = useSyncExternalStore(
    subscribeDesktop,
    readIsDesktopViewport,
    () => false,
  );

  /** En la app instalada (tablet/celular) siempre menú overlay, no sidebar fijo. */
  const useDesktopSidebar = isDesktopViewport && !isStandalone;

  return { useDesktopSidebar, isStandalone };
}
