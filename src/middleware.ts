import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getRequiredPermissionForPath,
  hasPermission,
} from "@/lib/auth/permissions";
import type { AppUserRole } from "@/types/auth";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/ical/export",
  "/api/ical/(.*)",
]);

const isUnauthorizedPage = createRouteMatcher(["/unauthorized"]);

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

    const authState = await auth();
    if (!authState.userId) {
      await auth.protect();
      return;
    }

    if (isUnauthorizedPage(request)) {
      return;
    }

    const metadata = authState.sessionClaims?.publicMetadata as
      | { role?: AppUserRole }
      | undefined;
    const role = metadata?.role;

    const permission = getRequiredPermissionForPath(request.nextUrl.pathname);

    if (permission && role && !hasPermission(role, permission)) {
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
