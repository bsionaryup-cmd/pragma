import { rewriteClerkFapiHandshakeLocationUrl } from "@/lib/auth/clerk-handshake-rewrite";
import {
  clientUatCookieNamesFromHeader,
  clientUatExpireTargets,
  resolveIncompleteSessionBridge,
} from "@/lib/auth/clerk-incomplete-session-bridge";
import {
  CLERK_PROXY_PATH,
  shouldProxyClerkFrontendApi,
} from "@/lib/auth/clerk-proxy-config";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { getRoleFromSessionClaims } from "@/lib/auth/session-claims";
import {
  getRequiredPermissionForPath,
  hasPermission,
  hasRouteAccess,
  isProtectedDashboardPath,
} from "@/lib/auth/permissions";
import {
  OWNER_DASHBOARD_PATH,
  OWNER_LOGIN_PATH,
  PLATFORM_OWNER_API_PREFIX,
} from "@/lib/platform/middleware-paths";

/** Server Actions use `Next-Action`; a 302/401 from middleware breaks Flight. */
function isNextServerAction(request: NextRequest): boolean {
  return (
    request.method === "POST" &&
    (request.headers.has("next-action") || request.headers.has("Next-Action"))
  );
}

const isOwnerRoute = createRouteMatcher([
  `${OWNER_DASHBOARD_PATH}(.*)`,
  `${PLATFORM_OWNER_API_PREFIX}(.*)`,
]);

const isOwnerLoginRoute = createRouteMatcher([`${OWNER_LOGIN_PATH}(.*)`]);

/**
 * Canonical app prefixes (lowercase). Typos like /OWNer-dashboard must not 404.
 * Only redirects when casing differs — exact paths are untouched.
 */
const CASE_CANONICAL_PREFIXES = [
  OWNER_DASHBOARD_PATH,
  OWNER_LOGIN_PATH,
  "/panel",
  "/calendar",
  "/properties",
  "/web-builder",
  "/integrations",
  "/smart-access",
  "/finance",
  "/settings",
  "/login",
  "/sign-in",
  "/sign-up",
  "/owner-login",
  "/post-login",
  "/auth/continue",
  "/onboarding",
  "/unauthorized",
] as const;

function canonicalizePathnameCasing(pathname: string): string | null {
  if (!pathname || pathname === "/") return null;
  const lower = pathname.toLowerCase();
  for (const canonical of CASE_CANONICAL_PREFIXES) {
    if (lower === canonical || lower.startsWith(`${canonical}/`)) {
      const normalized = canonical + lower.slice(canonical.length);
      return normalized === pathname ? null : normalized;
    }
  }
  return null;
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/contact",
  "/demo",
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/owner-login(.*)",
  "/auth/continue",
  "/forgot-password",
  "/account-suspended",
  "/api/auth/session-ready",
  "/api/auth/establish-session",
  "/api/webhooks(.*)",
  "/api/payments/wompi/webhook",
  "/api/ical/export",
  "/api/ical/(.*)",
  "/api/cron/(.*)",
  "/api/inbound/(.*)",
  "/api/integrations/ttlock/callback",
  "/api/integrations/ttlock/webhook/(.*)",
  "/guest-registration",
  "/guest-registration/(.*)",
  "/stay",
  "/stay/(.*)",
  "/m/(.*)",
  "/landing-product-screenshot-preview",
  "/urbanovaloft",
  "/urbanovaloft/(.*)",
  "/api/web-builder(.*)",
]);

/** APIs that authenticate inside the route handler — skip duplicate Clerk auth in proxy. */
const isSelfAuthedApi = createRouteMatcher([
  "/api/airbnb/auto-sync",
  "/api/integrations/ttlock/connect",
  "/api/integrations/ttlock/disconnect",
  "/api/integrations/ttlock/status",
  "/api/integrations/ttlock/test",
]);

const isUnauthorizedPage = createRouteMatcher(["/unauthorized"]);

/** Public tenant sites: `/w/{slug}` only (not `/w/{slug}/preview`). */
function isPublicTenantWebSitePath(pathname: string): boolean {
  if (!pathname.startsWith("/w/")) return false;
  if (pathname.includes("/preview")) return false;
  const segments = pathname.slice(3).split("/").filter(Boolean);
  return segments.length === 1;
}

/**
 * Sole Clerk FAPI proxy: middleware `frontendApiProxy` (App Router duplicate removed).
 * enabled(url) keeps www + Vercel Preview proxied; localhost never (host_invalid).
 */
const clerkMiddlewareOptions = {
  frontendApiProxy: {
    enabled: (url: URL) => shouldProxyClerkFrontendApi(url),
    path: CLERK_PROXY_PATH,
  },
};

function forwardWithPathname(request: NextRequest | Request, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  // Include search so dashboard guards can detect `?impersonating=1`.
  const search =
    "nextUrl" in request && request.nextUrl
      ? request.nextUrl.search
      : "";
  requestHeaders.set("x-pathname", `${pathname}${search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/** Expire stale `__client_uat` so the next document hit does not re-handshake. */
function expireStaleClientUatCookies(
  response: NextResponse,
  request: NextRequest,
): void {
  const requestUrl = request.nextUrl;
  const secure = requestUrl.protocol === "https:";
  const names = clientUatCookieNamesFromHeader(request.headers.get("cookie"));
  const domainTargets = clientUatExpireTargets(requestUrl.hostname);

  // Use append: response.cookies.set() overwrites same-name cookies and would
  // drop the host-only expire when also setting Domain=pragmapms.com.
  const appendExpire = (name: string, domain?: string) => {
    const parts = [
      `${name}=`,
      "Path=/",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "SameSite=Lax",
    ];
    if (secure) parts.push("Secure");
    if (domain) parts.push(`Domain=${domain}`);
    response.headers.append("Set-Cookie", parts.join("; "));
  };

  for (const name of names) {
    appendExpire(name);
  }

  for (const target of domainTargets) {
    if (!target.domain) continue;
    appendExpire(target.name, target.domain);
  }
}

/**
 * @clerk/backend may still emit handshake Location against broken custom FAPI
 * hosts; rewrite onto same-origin `/__clerk` when this request is proxied.
 *
 * Incomplete cookies (`client-uat-but-no-session-token`): do NOT follow handshake
 * (it wipes cookies). Protected routes → one hop to login + clear UAT.
 * Auth surfaces → clear UAT + one reload (never self-loop; avoids RSC 500 with dirty jar).
 */
function rewriteClerkFapiHandshakeLocation(
  response: Response,
  request: NextRequest,
): Response {
  const clerkStatus = response.headers.get("x-clerk-auth-status");
  const clerkReason = response.headers.get("x-clerk-auth-reason") ?? "";
  const location = response.headers.get("location");

  if (
    clerkStatus === "handshake" &&
    clerkReason.includes("client-uat-but-no-session-token")
  ) {
    const decision = resolveIncompleteSessionBridge(
      request.nextUrl.pathname,
      request.nextUrl.search,
    );

    if (decision.action === "pass-through") {
      const reload = request.nextUrl.clone();
      // One-shot clear: expire UAT then reload. Avoid next() on the dirty request
      // (auth()/RSC can 500 while __client_uat is still on the inbound Cookie header).
      if (reload.searchParams.get("uat_cleared") !== "1") {
        reload.searchParams.set("uat_cleared", "1");
        const clearRedirect = NextResponse.redirect(reload, 307);
        clearRedirect.headers.set(
          "x-pragma-clerk-handshake-bypass",
          "auth-surface-clear",
        );
        clearRedirect.headers.set("cache-control", "no-store");
        expireStaleClientUatCookies(clearRedirect, request);
        return clearRedirect;
      }

      const pass = forwardWithPathname(request, request.nextUrl.pathname);
      pass.headers.set("x-pragma-clerk-handshake-bypass", "auth-surface-pass");
      pass.headers.set("cache-control", "no-store");
      expireStaleClientUatCookies(pass, request);
      return pass;
    }

    const bridge = new URL(decision.loginPath, request.url);
    bridge.searchParams.set(decision.redirectParam, decision.nextPath);
    bridge.searchParams.set("uat_cleared", "1");
    const headers = new Headers();
    headers.set("location", bridge.toString());
    headers.set("x-pragma-clerk-handshake-bypass", decision.marker);
    headers.set("cache-control", "no-store");
    const redirect = new NextResponse(null, { status: 307, headers });
    expireStaleClientUatCookies(redirect, request);
    return redirect;
  }

  if (!shouldProxyClerkFrontendApi(request.nextUrl)) return response;
  if (!location) return response;

  const rewritten = rewriteClerkFapiHandshakeLocationUrl(
    location,
    request.nextUrl.origin,
    CLERK_PROXY_PATH,
  );
  if (!rewritten) return response;

  const headers = new Headers(response.headers);
  headers.set("location", rewritten);
  headers.set("x-pragma-clerk-handshake-rewrite", "1");

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const clerkHandler = clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;

  const cased = canonicalizePathnameCasing(pathname);
  if (cased) {
    const url = request.nextUrl.clone();
    url.pathname = cased;
    return NextResponse.redirect(url);
  }

  // Legacy list UI removed — calendar is the only reservations surface.
  const lowerPath = pathname.toLowerCase();
  if (lowerPath === "/reservations" || lowerPath.startsWith("/reservations/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/calendar";
    return NextResponse.redirect(url);
  }

  // Master Simplification: Bandeja / Novedades / Tareas / AI Concierge folded into /panel.
  if (
    lowerPath === "/novedades" ||
    lowerPath.startsWith("/novedades/") ||
    lowerPath === "/inbox" ||
    lowerPath.startsWith("/inbox/") ||
    lowerPath === "/tasks" ||
    lowerPath.startsWith("/tasks/") ||
    lowerPath === "/ai-concierge" ||
    lowerPath.startsWith("/ai-concierge/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // INTIENDAS product retired: only PMS unified /login.
  if (lowerPath === "/intiendas" || lowerPath.startsWith("/intiendas/")) {
    const url = request.nextUrl.clone();
    if (
      lowerPath === "/intiendas/login" ||
      lowerPath.startsWith("/intiendas/login/")
    ) {
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    url.pathname = "/panel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (lowerPath === "/owner-dashboard/intiendas" || lowerPath.startsWith("/owner-dashboard/intiendas/")) {
    const url = request.nextUrl.clone();
    url.pathname = OWNER_DASHBOARD_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublicRoute(request) || isPublicTenantWebSitePath(pathname)) {
    return forwardWithPathname(request, pathname);
  }

  if (isSelfAuthedApi(request)) {
    return forwardWithPathname(request, pathname);
  }

  if (isUnauthorizedPage(request)) {
    return forwardWithPathname(request, pathname);
  }

  if (isNextServerAction(request)) {
    return forwardWithPathname(request, pathname);
  }

  if (isOwnerRoute(request)) {
    // Owner APIs authenticate inside requirePlatformOwnerUser (Node). Avoid Edge
    // middleware 401s that surface as "Unauthorized" while the dashboard RSC is signed-in.
    if (pathname.startsWith(PLATFORM_OWNER_API_PREFIX)) {
      return forwardWithPathname(request, pathname);
    }
    const authState = await auth();
    if (!authState.userId) {
      const loginUrl = new URL(OWNER_LOGIN_PATH, request.url);
      loginUrl.searchParams.set("redirect_url", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return forwardWithPathname(request, pathname);
  }

  if (isOwnerLoginRoute(request)) {
    return forwardWithPathname(request, pathname);
  }

  const authState = await auth();
  if (!authState.userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL(OWNER_LOGIN_PATH, request.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // WEB BUILDER draft preview: signed-in + website:read only.
  if (pathname.startsWith("/w/") && pathname.endsWith("/preview")) {
    const permission = getRequiredPermissionForPath("/web-builder");
    const previewRole = getRoleFromSessionClaims(authState.sessionClaims);
    if (!previewRole || !permission || !hasPermission(previewRole, permission)) {
      const url = new URL("/unauthorized", request.url);
      return NextResponse.redirect(url);
    }
    return forwardWithPathname(request, pathname);
  }

  if (!isProtectedDashboardPath(pathname)) {
    return forwardWithPathname(request, pathname);
  }

  const role = getRoleFromSessionClaims(authState.sessionClaims);

  if (!role) {
    return forwardWithPathname(request, pathname);
  }

  const permission = getRequiredPermissionForPath(pathname);
  if (!permission || !hasRouteAccess(role, pathname)) {
    const url = new URL("/unauthorized", request.url);
    return NextResponse.redirect(url);
  }

  return forwardWithPathname(request, pathname);
}, clerkMiddlewareOptions);

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = await clerkHandler(request, event);
  if (!response) {
    return NextResponse.next();
  }
  return rewriteClerkFapiHandshakeLocation(response, request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
