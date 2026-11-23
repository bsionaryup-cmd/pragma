"use client";

import { ClerkInstanceContext } from "@clerk/shared/react";
import { useCallback, useContext } from "react";

type ClientSignOutOptions = {
  redirectUrl: string;
};

export function redirectToSignOut(redirectUrl: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(redirectUrl);
}

/**
 * Prefer Clerk `signOut` when `ClerkProvider` context is present; otherwise fall back to navigation.
 * Uses `ClerkInstanceContext` directly so missing provider does not throw during render.
 */
export function useClientSignOut({ redirectUrl }: ClientSignOutOptions) {
  const clerk = useContext(ClerkInstanceContext)?.value;

  return useCallback(async () => {
    if (clerk?.loaded && typeof clerk.signOut === "function") {
      try {
        await clerk.signOut({ redirectUrl });
        return;
      } catch (error) {
        console.warn("[clerk] signOut failed; falling back to redirect", error);
      }
    }
    redirectToSignOut(redirectUrl);
  }, [clerk, redirectUrl]);
}