import { NextResponse } from "next/server";
import { handleTTLockOAuthCallback } from "@/services/integrations/ttlock/ttlock.service";
import {
  PRAGMA_CANONICAL_TTLOCK_CALLBACK,
  TTLOCK_CALLBACK_PATH,
} from "@/lib/integrations/ttlock-url";

export const runtime = "nodejs";

/** TTLock OAuth return or health check (GET without code). */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const hasOAuthParams =
    url.searchParams.has("code") ||
    url.searchParams.has("state") ||
    url.searchParams.has("error");

  if (!hasOAuthParams) {
    return NextResponse.json({
      ok: true,
      service: "ttlock-oauth-callback",
      path: TTLOCK_CALLBACK_PATH,
      canonical: PRAGMA_CANONICAL_TTLOCK_CALLBACK,
      message: "Callback route reachable",
    });
  }

  const { redirectPath } = await handleTTLockOAuthCallback({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    error: url.searchParams.get("error"),
    errorDescription: url.searchParams.get("error_description"),
  });

  return NextResponse.redirect(new URL(redirectPath, request.url));
}
