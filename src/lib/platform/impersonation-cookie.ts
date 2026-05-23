import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { PLATFORM_IMPERSONATION_COOKIE } from "@/lib/platform/constants";

function getSigningSecret(): string {
  const secret =
    process.env.PLATFORM_IMPERSONATION_SECRET?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("PLATFORM_IMPERSONATION_SECRET or CLERK_SECRET_KEY required");
  }
  return secret;
}

function sign(sessionId: string): string {
  return createHmac("sha256", getSigningSecret()).update(sessionId).digest("hex");
}

export function createImpersonationCookieValue(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

export function parseImpersonationCookieValue(
  value: string | undefined,
): string | null {
  if (!value) return null;
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) return null;

  const expected = sign(sessionId);
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return sessionId;
}

export async function readImpersonationSessionIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PLATFORM_IMPERSONATION_COOKIE)?.value;
  return parseImpersonationCookieValue(raw);
}

export function buildImpersonationSetCookieHeader(sessionId: string): string {
  const value = createImpersonationCookieValue(sessionId);
  const maxAge = Math.floor(
    Number(process.env.PLATFORM_IMPERSONATION_TTL_MS ?? 2 * 60 * 60 * 1000) / 1000,
  );
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${PLATFORM_IMPERSONATION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildImpersonationClearCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${PLATFORM_IMPERSONATION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
