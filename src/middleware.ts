import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRoleFromSessionClaims } from "@/lib/auth/session-claims";
import {
  getRequiredPermissionForPath,
  hasRouteAccess,
  isProtectedDashboardPath,
} from "@/lib/auth/permissions";

import type { AppUserRole } from "@/types/auth";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/contact",
  "/demo",
  "/sign-in(.*)",
  "/sign-up(.*)",
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

    const authState = await auth();
    if (!authState.userId) {
      await auth.protect();
      return;
    }

    if (isUnauthorizedPage(request)) {
      return;
    }

    const pathname = request.nextUrl.pathname;
    if (!isProtectedDashboardPath(pathname)) {
      return;
    }

    let role = getRoleFromSessionClaims(authState.sessionClaims);

    // RBAC without role in JWT is enforced in Server Components (requirePermission).
    // Skipping the Clerk users.getUser() fallback saves ~400–900ms per navigation.
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
