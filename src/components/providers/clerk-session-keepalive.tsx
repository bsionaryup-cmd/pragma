"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/** Refresh before typical short session JWT (~60s) expires. */
const KEEP_ALIVE_MS = 45_000;

/**
 * Keeps the Clerk session cookie (`__session`) fresh while the user stays in
 * the app. Without this, short JWTs expire mid-session, middleware triggers a
 * handshake against the broken custom FAPI host, cookies get wiped
 * (`Expires=1970`), and it looks like the system logged the user out.
 *
 * Does not call `signOut`. Logout remains explicit (UI / SignOutButton only).
 */
export function ClerkSessionKeepAlive() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { session } = useClerk();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const refresh = async () => {
      if (inFlight.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      inFlight.current = true;
      try {
        const token = await getToken({ skipCache: true }).catch(() => null);
        await session?.touch?.().catch(() => null);
        if (token) {
          await fetch("/api/auth/establish-session", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
          }).catch(() => null);
        }
      } finally {
        inFlight.current = false;
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, KEEP_ALIVE_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onFocus = () => {
      void refresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [getToken, isLoaded, isSignedIn, session]);

  return null;
}
