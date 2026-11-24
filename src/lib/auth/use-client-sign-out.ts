"use client";

import { ClerkInstanceContext } from "@clerk/shared/react";
import { useCallback, useContext } from "react";
import { performFullSignOut } from "@/lib/auth/full-sign-out";

type ClientSignOutOptions = {
  redirectUrl: string;
};

export function redirectToSignOut(redirectUrl: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(redirectUrl);
}

/**
 * Prefer Clerk `signOut` when `ClerkProvider` context is present; otherwise fall back to navigation.
 * Always expires residual `__client_uat*` cookies so T4 logout cannot re-trigger the T5 settle bridge.
 * Uses `ClerkInstanceContext` directly so missing provider does not throw during render.
 */
export function useClientSignOut({ redirectUrl }: ClientSignOutOptions) {
  const clerk = useContext(ClerkInstanceContext)?.value;

  return useCallback(async () => {
    if (clerk?.loaded && typeof clerk.signOut === "function") {
      try {
        await performFullSignOut(
          (opts) => clerk.signOut(opts),
          redirectUrl,
        );
        return;
      } catch (error) {
        console.warn("[clerk] signOut failed; falling back to redirect", error);
      }
    }
    // Still clear UAT even when Clerk context is missing.
    await performFullSignOut(async () => {
      redirectToSignOut(redirectUrl);
    }, redirectUrl);
  }, [clerk, redirectUrl]);
}