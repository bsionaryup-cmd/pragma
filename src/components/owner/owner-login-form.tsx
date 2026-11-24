"use client";

import { useEffect } from "react";
import {
  OWNER_DASHBOARD_PATH,
  OWNER_LOGIN_PATH,
} from "@/lib/platform/constants.client";

/**
 * Deprecated: `/owner-login` now server-redirects to `/sign-in`.
 * Kept as a no-op client redirect for any stale client imports.
 */
export function OwnerLoginForm({
  postAuthPath,
}: {
  serverSessionActive?: boolean;
  postAuthPath?: string;
} = {}) {
  useEffect(() => {
    const next = postAuthPath?.startsWith("/")
      ? postAuthPath
      : OWNER_DASHBOARD_PATH;
    window.location.replace(`/sign-in?next=${encodeURIComponent(next)}`);
  }, [postAuthPath]);

  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      Redirigiendo a acceso… ({OWNER_LOGIN_PATH} → /sign-in)
    </p>
  );
}
