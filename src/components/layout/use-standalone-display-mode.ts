"use client";

import { useSyncExternalStore } from "react";

function readStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;

  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return standaloneQuery.matches || fullscreenQuery.matches || iosStandalone;
}

function subscribe(onStoreChange: () => void) {
  const queries = [
    window.matchMedia("(display-mode: standalone)"),
    window.matchMedia("(display-mode: fullscreen)"),
  ];

  for (const query of queries) {
    query.addEventListener("change", onStoreChange);
  }

  return () => {
    for (const query of queries) {
      query.removeEventListener("change", onStoreChange);
    }
  };
}

/** App instalada (PWA / “Añadir a pantalla de inicio”). */
export function useStandaloneDisplayMode(): boolean {
  return useSyncExternalStore(subscribe, readStandaloneDisplayMode, () => false);
}
