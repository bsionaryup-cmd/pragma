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

export default clerkMiddleware(
  async (auth, request) => {
    if (isPublicRoute(request)) {
      return;
    }

    if (isSelfAuthedApi(request)) {
      return;
    }

    if (isUnauthorizedPage(request)) {
      return;
    }

    const pathname = request.nextUrl.pathname;

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
      return;
    }

    if (isOwnerLoginRoute(request)) {
      return;
    }

    const authState = await auth();
    if (!authState.userId) {
      await auth.protect();
      return;
    }

    if (!isProtectedDashboardPath(pathname)) {
      return;
    }

    const role = getRoleFromSessionClaims(authState.sessionClaims);

    if (!role) {
      return;
    }

    const permission = getRequiredPermissionForPath(pathname);
    if (!permission || !hasRouteAccess(role, pathname)) {
      const url = new URL("/unauthorized", request.url);
      return NextResponse.redirect(url);
    }
  },
  clerkMiddlewareOptions,
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
