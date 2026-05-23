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

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/contact",
  "/demo",
  "/sign-in(.*)",
  "/sign-up(.*)",
  `${OWNER_LOGIN_PATH}(.*)`,
  "/account-suspended",
  "/api/webhooks(.*)",
  "/api/payments/wompi/webhook",
  "/api/ical/export",
  "/api/ical/(.*)",
  "/api/cron/(.*)",
  "/api/integrations/ttlock/callback",
  "/guest-registration/(.*)",
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

const useClerkProxy =
  process.env.NODE_ENV === "production" &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PROXY_URL);

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
      await auth.protect();
      return;
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
  ],
};
