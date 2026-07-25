import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRoleFromSessionClaims } from "@/lib/auth/session-claims";
import {
  getRequiredPermissionForPath,
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

/**
 * Canonical app prefixes (lowercase). Typos like /OWNer-dashboard must not 404.
 * Only redirects when casing differs — exact paths are untouched.
 */
const CASE_CANONICAL_PREFIXES = [
  OWNER_DASHBOARD_PATH,
  OWNER_LOGIN_PATH,
  "/panel",
  "/calendar",
  "/reservations",
  "/properties",
  "/integrations",
  "/smart-access",
  "/novedades",
  "/finance",
  "/settings",
  "/tasks",
  "/inbox",
  "/sign-in",
  "/sign-up",
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
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password",
  `${OWNER_LOGIN_PATH}(.*)`,
  "/account-suspended",
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
  "/offer/(.*)",
  "/landing-product-screenshot-preview",
]);

/** APIs that authenticate inside the route handler — skip duplicate Clerk auth in proxy. */
const isSelfAuthedApi = createRouteMatcher([
  "/api/airbnb/auto-sync",
  "/api/integrations/ttlock/connect",
  "/api/integrations/ttlock/disconnect",
  "/api/integrations/ttlock/status",
  "/api/integrations/ttlock/test",
  // AI Concierge extension: short-lived Bearer linked from authenticated PRAGMA.
  "/api/concierge/channel/(.*)",
  "/api/concierge/commercial/(.*)",
  "/api/concierge/health",
  "/api/concierge/heartbeat",
  "/api/concierge/link/complete",
]);

const isUnauthorizedPage = createRouteMatcher(["/unauthorized"]);

// Production always proxies FAPI through /__clerk. Custom domain
// clerk.pragmapms.com can hang TLS/SSL while CNAME exists; without proxy,
// clerk-js never loads and /sign-in stays on "Ingresando…".
// (Clerk auto-proxy only covers *.vercel.app — not custom apex domains.)
const useClerkProxy =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim());

const clerkMiddlewareOptions = useClerkProxy
  ? { frontendApiProxy: { enabled: true as const } }
  : {};

function forwardWithPathname(request: Request, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default clerkMiddleware(
  async (auth, request) => {
    const pathname = request.nextUrl.pathname;

    const cased = canonicalizePathnameCasing(pathname);
    if (cased) {
      const url = request.nextUrl.clone();
      url.pathname = cased;
      return NextResponse.redirect(url);
    }

    if (isPublicRoute(request)) {
      return forwardWithPathname(request, pathname);
    }

    if (isSelfAuthedApi(request)) {
      return forwardWithPathname(request, pathname);
    }

    if (isUnauthorizedPage(request)) {
      return forwardWithPathname(request, pathname);
    }

    if (isOwnerRoute(request)) {
      const authState = await auth();
      if (!authState.userId) {
        if (pathname.startsWith(PLATFORM_OWNER_API_PREFIX)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL(OWNER_LOGIN_PATH, request.url);
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
      // Prefer explicit redirect over auth.protect() rewrite-to-404.
      // protect() + Clerk Development keys on a production domain yields:
      // X-Clerk-Auth-Reason: protect-rewrite, dev-browser-missing → /_not-found
      // and the Clerk client UI "This page couldn't load / ERROR <digest>".
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", pathname);
      return NextResponse.redirect(signInUrl);
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
  },
  clerkMiddlewareOptions,
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Must be explicit: /__clerk/npm/.../*.js is excluded by the static-file
    // negative lookahead above, and without it clerk-js never loads via proxy.
    "/__clerk/(.*)",
  ],
};
