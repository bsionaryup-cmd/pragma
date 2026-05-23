import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isAuthErrorResponse,
  requireTTLockApiAdmin,
} from "@/lib/integrations/ttlock-api-auth";
import { PRAGMA_TTLOCK_COOKIE_DOMAIN, resolveTTLockAppRedirectUrl } from "@/lib/integrations/ttlock-config";
import { beginTTLockConnect } from "@/services/integrations/ttlock/ttlock.service";
import { TTLOCK_OAUTH_STATE_COOKIE } from "@/services/integrations/ttlock/ttlock-oauth-state";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireTTLockApiAdmin(request);
  if (isAuthErrorResponse(authResult)) return authResult;

  try {
    const session = await beginTTLockConnect(
      authResult.auth.dbUserId,
      authResult.request,
    );

    const cookieStore = await cookies();
    cookieStore.set(TTLOCK_OAUTH_STATE_COOKIE, session.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
      ...(PRAGMA_TTLOCK_COOKIE_DOMAIN
        ? { domain: PRAGMA_TTLOCK_COOKIE_DOMAIN }
        : {}),
    });

    return NextResponse.redirect(session.redirectUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo iniciar la conexión";
    const redirectUrl = resolveTTLockAppRedirectUrl(
      `/integrations/ttlock?error=${encodeURIComponent(message)}`,
      request.url,
    );
    return NextResponse.redirect(redirectUrl);
  }
}
