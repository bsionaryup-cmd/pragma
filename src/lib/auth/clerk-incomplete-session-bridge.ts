/**
 * Incomplete Clerk cookies (`__client_uat` without `__session`) make
 * @clerk/backend emit handshake `client-uat-but-no-session-token`.
 *
 * Following that handshake wipes cookies. PRAGMA intercepts it ("settle-bridge").
 * Redirecting again while already on `/login` causes ERR_TOO_MANY_REDIRECTS.
 *
 * Pure decision helper — no Next.js Response objects (unit-testable).
 */

import { APP_LOGIN_PATH } from "@/lib/auth/auth-paths";

export type IncompleteSessionBridgeDecision =
  | {
      action: "pass-through";
      marker: "auth-surface-pass";
    }
  | {
      action: "redirect";
      marker: "settle-bridge";
      loginPath: "/sign-in" | "/owner-login" | "/login";
      /** Destination after login (path + optional search). */
      nextPath: string;
      /** Query param name Clerk / our forms already understand. */
      redirectParam: "redirect_url" | "next";
    };

function isAuthSurfacePath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/owner-login") ||
    pathname === "/auth/continue" ||
    pathname.startsWith("/auth/continue/") ||
    pathname.startsWith("/auth/impersonation") ||
    pathname.startsWith("/forgot-password")
  );
}

/**
 * Decide how to handle handshake reason `client-uat-but-no-session-token`.
 */
export function resolveIncompleteSessionBridge(
  pathname: string,
  search = "",
): IncompleteSessionBridgeDecision {
  if (isAuthSurfacePath(pathname)) {
    return { action: "pass-through", marker: "auth-surface-pass" };
  }

  const rawPath = `${pathname}${search}` || "/panel";

  return {
    action: "redirect",
    marker: "settle-bridge",
    loginPath: APP_LOGIN_PATH,
    nextPath: rawPath.startsWith("/") ? rawPath : `/${rawPath}`,
    redirectParam: "redirect_url",
  };
}

/** Host-only + registrable-domain expire targets for `__client_uat`. */
export function clientUatExpireTargets(hostname: string): Array<{
  name: string;
  domain?: string;
}> {
  const targets: Array<{ name: string; domain?: string }> = [
    { name: "__client_uat" },
  ];

  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "pragmapms.com" || host.endsWith(".pragmapms.com")) {
    targets.push({ name: "__client_uat", domain: "pragmapms.com" });
  }

  return targets;
}

/**
 * Collect `__client_uat` / `__client_uat_<suffix>` names present on the request
 * so we can expire host-only copies the browser already holds.
 */
export function clientUatCookieNamesFromHeader(
  cookieHeader: string | null | undefined,
): string[] {
  if (!cookieHeader?.trim()) return ["__client_uat"];
  const names = new Set<string>(["__client_uat"]);
  for (const part of cookieHeader.split(";")) {
    const name = part.trim().split("=")[0]?.trim();
    if (!name) continue;
    if (name === "__client_uat" || name.startsWith("__client_uat_")) {
      names.add(name);
    }
  }
  return [...names];
}
