import { verifyToken } from "@clerk/backend";
import {
  getCookieSuffix,
  getSuffixedCookieName,
} from "@clerk/shared/keys";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Body = {
  token?: unknown;
};

function cookieOptions(maxAge: number, secure: boolean, httpOnly: boolean) {
  return {
    httpOnly,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * After Clerk finalize, the browser often has a JWT in memory but no session
 * cookie Clerk middleware will accept. Production uses *suffixed* cookies
 * (`__session_<hash>`, `__client_uat_<hash>`); writing only unsuffixed names
 * made auth() ignore the cookie → handshake wipe → bounce to /sign-in.
 *
 * Option A: set both unsuffixed and suffixed cookies from a verified JWT.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  try {
    const payload = await verifyToken(token, { secretKey });

    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === "number" ? payload.exp : now + 60;
    const iat = typeof payload.iat === "number" ? payload.iat : now;
    const maxAge = Math.max(30, exp - now);
    const secure = process.env.NODE_ENV === "production";
    const uat = String(iat);
    const uatMaxAge = 60 * 60 * 24 * 365;

    const res = NextResponse.json(
      {
        ok: true,
        userId: payload.sub ?? null,
        suffixed: Boolean(publishableKey),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );

    // Unsuffixed (dev + fallback when Clerk prefers plain cookies).
    res.cookies.set("__session", token, cookieOptions(maxAge, secure, true));
    res.cookies.set("__client_uat", uat, cookieOptions(uatMaxAge, secure, false));

    // Suffixed (production Clerk authenticateRequest when UAT suffix exists).
    if (publishableKey) {
      const suffix = await getCookieSuffix(publishableKey);
      res.cookies.set(
        getSuffixedCookieName("__session", suffix),
        token,
        cookieOptions(maxAge, secure, true),
      );
      res.cookies.set(
        getSuffixedCookieName("__client_uat", suffix),
        uat,
        cookieOptions(uatMaxAge, secure, false),
      );
    }

    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }
}
