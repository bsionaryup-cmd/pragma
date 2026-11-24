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

const isOwnerRoute = createRouteMatcher([
  `${OWNER_DASHBOARD_PATH}(.*)`,
  `${PLATFORM_OWNER_API_PREFIX}(.*)`,
]);

const isOwnerLoginRoute = createRouteMatcher([`${OWNER_LOGIN_PATH}(.*)`]);
const isRetailRoute = createRouteMatcher(["/intiendas(.*)"]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/contact",
  "/demo",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login(.*)",
  "/forgot-password",
  "/intiendas/login",
  "/intiendas/login/recuperar",
  `${OWNER_LOGIN_PATH}(.*)`,
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
  "/guest-registration/(.*)",
  "/stay/(.*)",
  "/m/(.*)",
  "/offer/(.*)",
  "/landing-product-screenshot-preview",
  "/urbanovaloft",
  "/urbanovaloft/(.*)",
  "/api/web-builder(.*)",
]);

const isUnauthorizedPage = createRouteMatcher(["/unauthorized"]);

/** APIs that authenticate inside the route handler — skip duplicate Clerk auth in proxy. */
const isSelfAuthedApi = createRouteMatcher([
  "/api/airbnb/auto-sync",
  "/api/integrations/ttlock/connect",
  "/api/integrations/ttlock/disconnect",
  "/api/integrations/ttlock/status",
  "/api/integrations/ttlock/test",
]);

const clerkMiddlewareOptions = {
  frontendApiProxy: {
    enabled: (url: URL) => shouldProxyClerkFrontendApi(url),
    path: CLERK_PROXY_PATH,
  },
};

/** Public tenant sites: `/w/{slug}` only (not `/w/{slug}/preview`). */
function isPublicTenantWebSitePath(pathname: string): boolean {
  if (!pathname.startsWith("/w/")) return false;
  if (pathname.includes("/preview")) return false;
  const segments = pathname.slice(3).split("/").filter(Boolean);
  return segments.length === 1;
}

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

function expireStaleClientUatCookies(
  response: NextResponse,
  request: NextRequest,
): void {
  const requestUrl = request.nextUrl;
  const secure = requestUrl.protocol === "https:";
  const names = clientUatCookieNamesFromHeader(request.headers.get("cookie"));
  const domainTargets = clientUatExpireTargets(requestUrl.hostname);

  const appendExpire = (name: string, domain?: string) => {
    const parts = [
      `${name}=`,
      "Path=/",
      "Max-Age=0",
      "SameSite=Lax",
      ...(secure ? ["Secure"] : []),
      ...(domain ? [`Domain=${domain}`] : []),
    ];
    response.headers.append("set-cookie", parts.join("; "));
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
 * Incomplete cookies (`client-uat-but-no-session-token`): do NOT follow handshake
 * (it wipes cookies). Auth surfaces clear UAT; protected routes → login.
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

  if (isPublicRoute(request) || isPublicTenantWebSitePath(pathname)) {
    return forwardWithPathname(request, pathname);
  }

  if (isSelfAuthedApi(request)) {
    return forwardWithPathname(request, pathname);
  }

  if (isUnauthorizedPage(request)) {
    return forwardWithPathname(request, pathname);
  }

  if (isRetailRoute(request)) {
    const authState = await auth();
    if (!authState.userId) {
      const loginUrl = new URL("/intiendas/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return forwardWithPathname(request, pathname);
  }

  if (isOwnerRoute(request)) {
    if (pathname.startsWith(PLATFORM_OWNER_API_PREFIX)) {
      return forwardWithPathname(request, pathname);
    }
    const authState = await auth();
    if (!authState.userId) {
      const loginUrl = new URL("/sign-in", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return forwardWithPathname(request, pathname);
  }

  if (isOwnerLoginRoute(request)) {
    return forwardWithPathname(request, pathname);
  }

  const authState = await auth();
  if (!authState.userId) {
    const signInUrl = new URL("/sign-in", request.url);
    const nextPath = `${pathname}${request.nextUrl.search}`;
    signInUrl.searchParams.set("next", nextPath || "/panel");
    return NextResponse.redirect(signInUrl);
  }

  if (pathname.startsWith("/w/") && pathname.endsWith("/preview")) {
    const permission = getRequiredPermissionForPath("/web-builder");
    const role = getRoleFromSessionClaims(authState.sessionClaims);
    if (!role || !permission || !hasPermission(role, permission)) {
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
  const pathname = request.nextUrl.pathname;
  const lowerPath = pathname.toLowerCase();

  // Master Simplification: retire obsolete list UIs (align with local 0995c7f).
  // Calendar is the only reservations surface; inbox/tasks fold into panel/calendar.
  if (lowerPath === "/reservations" || lowerPath.startsWith("/reservations/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/calendar";
    return NextResponse.redirect(url);
  }
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
