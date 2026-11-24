"use client";

import { isPublicPostAuthPath } from "@/lib/auth/post-auth-paths";

export { buildAuthContinuePath } from "@/lib/auth/post-auth-paths";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function probeServerSessionReady(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session-ready", {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ready?: boolean };
    return Boolean(data.ready);
  } catch {
    return false;
  }
}

async function establishServerSessionCookie(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/establish-session", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

/**
 * Ensure server can read Clerk session cookies, then enter the app.
 *
 * 1) getToken (client JWT)
 * 2) POST /api/auth/establish-session → sets `__session` + `__client_uat`
 * 3) probe /api/auth/session-ready
 * 4) hard navigate only when ready
 */
export async function waitUntilClerkSessionCookieReady(input: {
  getToken?: (options?: { skipCache?: boolean }) => Promise<string | null>;
  touchSession?: () => Promise<unknown>;
  maxAttempts?: number;
}): Promise<boolean> {
  const maxAttempts = input.maxAttempts ?? 48;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await probeServerSessionReady()) {
      return true;
    }

    const token = input.getToken
      ? await input.getToken({ skipCache: true }).catch(() => null)
      : null;

    if (token) {
      await input.touchSession?.().catch(() => null);
      await establishServerSessionCookie(token);

      if (await probeServerSessionReady()) {
        return true;
      }
    }

    await sleep(250);
  }

  return false;
}

/**
 * login-settle-v2: establish cookie from JWT, then go. Never /auth/continue.
 */
export async function settleClerkSessionThenGo(input: {
  getToken?: (options?: { skipCache?: boolean }) => Promise<string | null>;
  touchSession?: () => Promise<unknown>;
  path: string;
  maxAttempts?: number;
  allowContinueFallback?: boolean;
  onPending?: () => void;
}): Promise<void> {
  const target = input.path.startsWith("/") ? input.path : `/${input.path}`;

  if (isPublicPostAuthPath(target)) {
    input.onPending?.();
    return;
  }

  const ready = await waitUntilClerkSessionCookieReady({
    getToken: input.getToken,
    touchSession: input.touchSession,
    maxAttempts: input.maxAttempts,
  });

  if (!ready) {
    input.onPending?.();
    return;
  }

  window.location.replace(target);
}
