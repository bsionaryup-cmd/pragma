/**
 * Single source of truth for Clerk Frontend API same-origin proxy (`/__clerk`).
 *
 * Evidence (2026-07-26):
 * - Production `https://www.pragmapms.com/__clerk/v1/environment` → 200
 * - Local `http://localhost:3000/__clerk/...` with pk_live → 400 `host_invalid`
 * - Direct FAPI `clerk.www.pragmapms.com` / `clerk.pragmapms.com` → TLS handshake fails
 * - Relative `proxyUrl="/__clerk"` on prod left users stuck: client JWT without
 *   server `__session` cookie → `/auth/continue` never became ready
 * - Absolute same-origin proxyUrl (`https://www.pragmapms.com/__clerk`) is required
 *   so Set-Cookie / handshake align with the live host (apex 307 → www)
 *
 * Therefore: enable proxy only on deploy hosts (www / Vercel), never on localhost.
 * Local development must use Clerk Development keys (`pk_test` / `sk_test`) without proxy.
 */

export const CLERK_PROXY_PATH = "/__clerk";

/** Canonical production origin for SSR absolute proxyUrl (apex redirects to www). */
export const CLERK_PRODUCTION_ORIGIN = "https://www.pragmapms.com";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return LOCAL_HOSTS.has(host);
}

/** Normalize env / absolute URL to a same-origin path for middleware proxy path. */
export function normalizeClerkProxyPath(raw: string): string {
  const value = raw.trim();
  if (!value) return CLERK_PROXY_PATH;
  if (value.startsWith("http")) {
    try {
      return new URL(value).pathname.replace(/\/$/, "") || CLERK_PROXY_PATH;
    } catch {
      return CLERK_PROXY_PATH;
    }
  }
  return value.startsWith("/") ? value : `/${value}`;
}

function proxyPathFromEnv(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
  if (!fromEnv) return undefined;
  return normalizeClerkProxyPath(fromEnv);
}

function absoluteProxyFromEnv(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
  if (!fromEnv) return undefined;
  if (fromEnv.startsWith("http")) {
    return fromEnv.replace(/\/$/, "");
  }
  return `${CLERK_PRODUCTION_ORIGIN}${normalizeClerkProxyPath(fromEnv)}`;
}

/**
 * Client / build-time: absolute URL passed to ClerkProvider.proxyUrl.
 * Relative `/__clerk` is insufficient on production (cookie / host mismatch).
 * - npm run dev → never
 * - localhost (incl. `next start`) → never
 * - Browser on deploy host → `${origin}/__clerk`
 * - Vercel Production SSR → `https://www.pragmapms.com/__clerk`
 */
export function resolveClerkProviderProxyUrl(): string | undefined {
  if (process.env.NODE_ENV !== "production") {
    return undefined;
  }

  if (typeof window !== "undefined") {
    if (isLocalHostname(window.location.hostname)) {
      return undefined;
    }
    const path = proxyPathFromEnv() ?? CLERK_PROXY_PATH;
    return `${window.location.origin}${path}`;
  }

  const absoluteEnv = absoluteProxyFromEnv();
  if (absoluteEnv) return absoluteEnv;
  if (process.env.VERCEL) {
    return `${CLERK_PRODUCTION_ORIGIN}${CLERK_PROXY_PATH}`;
  }
  return undefined;
}

/**
 * Edge middleware: whether to intercept `/__clerk` and forward to Clerk FAPI.
 * Request-scoped so Preview (`*.vercel.app`) and Production (www) stay proxied;
 * localhost never is.
 */
export function shouldProxyClerkFrontendApi(requestUrl: URL): boolean {
  if (isLocalHostname(requestUrl.hostname)) {
    return false;
  }

  if (process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim()) {
    return true;
  }

  // Vercel production + preview builds use NODE_ENV=production.
  if (process.env.NODE_ENV === "production") {
    return true;
  }

  return false;
}
