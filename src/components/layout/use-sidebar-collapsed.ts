"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pragma-sidebar-collapsed";

const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emitCollapsedChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(
    subscribe,
    readCollapsed,
    () => false,
  );

  const toggle = useCallback(() => {
    const next = !readCollapsed();
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
    emitCollapsedChange();
  }, []);

  return { collapsed, toggle, ready: true };
}
