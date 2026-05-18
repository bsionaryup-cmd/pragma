"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** Evita hydration mismatch en componentes que dependen del cliente. */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
