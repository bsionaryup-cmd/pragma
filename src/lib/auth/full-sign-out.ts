"use client";

import { APP_SIGNED_OUT_LOGIN_PATH } from "@/lib/auth/auth-paths";
import { clientUatExpireTargets } from "@/lib/auth/clerk-incomplete-session-bridge";

type SignOutFn = (opts?: { redirectUrl?: string }) => Promise<unknown>;

/**
 * Expire `__client_uat*` host/domain cookies in the browser after explicit logout.
 * Does not touch `__session` — Clerk `signOut` owns that.
 */
export function expireClientUatCookiesInBrowser(): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:";
  const hostname = window.location.hostname;
  const names = new Set<string>(["__client_uat"]);
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0]?.trim();
    if (!name) continue;
    if (name === "__client_uat" || name.startsWith("__client_uat_")) {
      names.add(name);
    }
  }

  const expire = (name: string, domain?: string) => {
    const parts = [
      `${name}=`,
      "Path=/",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "SameSite=Lax",
    ];
    if (secure) parts.push("Secure");
    if (domain) parts.push(`Domain=${domain}`);
    document.cookie = parts.join("; ");
  };

  for (const name of names) {
    expire(name);
  }
  // Also expire host + registrable-domain copies for every UAT name we saw
  // (suffixed production cookies are easy to miss with host-only clears).
  for (const target of clientUatExpireTargets(hostname)) {
    if (!target.domain) continue;
    for (const name of names) {
      expire(name, target.domain);
    }
  }
}

export async function performFullSignOut(
  signOut: SignOutFn,
  redirectUrl: string = APP_SIGNED_OUT_LOGIN_PATH,
): Promise<void> {
  expireClientUatCookiesInBrowser();
  await signOut({ redirectUrl });
}
