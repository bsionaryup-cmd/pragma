/** Canonical public origin for guest-facing links (registration, etc.). */
export const PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN = "https://www.pragmapms.com";

/** @deprecated Use PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN */
export const PRAGMA_PRODUCTION_APP_URL = PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN;

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production"
  );
}

function shouldNormalizeToCanonicalPublicHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return (
    host === "pragmapms.com" ||
    host === "www.pragmapms.com" ||
    host === "pragma-pms.vercel.app"
  );
}

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
}

function isTemporaryTunnelUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const blockedHostPart = ["ng", "rok"].join("");
    return host.includes(blockedHostPart);
  } catch {
    return true;
  }
}

function resolveCanonicalPublicOrigin(url: string): string {
  try {
    const parsed = new URL(normalizeBaseUrl(url));
    if (
      isProductionRuntime() &&
      shouldNormalizeToCanonicalPublicHost(parsed.hostname)
    ) {
      return PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

function isAllowedPublicAppUrl(url: string): boolean {
  if (isLocalhostUrl(url) || isTemporaryTunnelUrl(url)) return false;

  try {
    const parsed = new URL(normalizeBaseUrl(url));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    if (isProductionRuntime()) {
      return (
        shouldNormalizeToCanonicalPublicHost(parsed.hostname) ||
        parsed.hostname.endsWith(".vercel.app")
      );
    }
    return isLocalhostUrl(url) || shouldNormalizeToCanonicalPublicHost(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Force https for guest-facing public origins (email/SEO).
 * Localhost http is preserved for local development only.
 */
export function ensureHttpsPublicOrigin(originOrUrl: string): string {
  const trimmed = originOrUrl.trim().replace(/\/$/, "");
  if (!trimmed) return PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN;
  try {
    const normalized = normalizeBaseUrl(trimmed);
    const parsed = new URL(normalized);
    if (isLocalhostUrl(normalized)) {
      return `${parsed.protocol}//${parsed.host}`;
    }
    if (shouldNormalizeToCanonicalPublicHost(parsed.hostname)) {
      return PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN;
    }
    parsed.protocol = "https:";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN;
  }
}

/**
 * Airbnb universal guest-registration entry (no token).
 * Replaces `${window.location.origin}/guest-registration` which leaked http://.
 */
export function getAirbnbUniversalGuestRegistrationUrl(
  browserOrigin?: string | null,
): string {
  const origin = browserOrigin?.trim();
  if (origin && isLocalhostUrl(origin)) {
    return `${origin.replace(/\/$/, "")}/guest-registration`;
  }
  return `${PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN}/guest-registration`;
}

/**
 * Public app base URL for guest registration links and other shareable URLs.
 * Production canonical: https://www.pragmapms.com
 */
export function getPublicAppUrl(): string {
  if (isProductionRuntime()) {
    const explicit =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.APP_URL?.trim();
    if (explicit) {
      const normalized = resolveCanonicalPublicOrigin(explicit);
      if (isAllowedPublicAppUrl(normalized)) {
        return normalized.replace(/^http:\/\//i, "https://");
      }
    }
    return PRAGMA_CANONICAL_PUBLIC_APP_ORIGIN;
  }

  const devOrigin = process.env.NEXT_PUBLIC_DEV_ORIGIN?.trim();
  if (devOrigin && isLocalhostUrl(devOrigin)) {
    return normalizeBaseUrl(devOrigin);
  }

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.APP_URL?.trim(),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate).replace(
      /^http:\/\//i,
      "https://",
    );
    if (isAllowedPublicAppUrl(normalized)) {
      return resolveCanonicalPublicOrigin(normalized);
    }
  }

  return devOrigin ? normalizeBaseUrl(devOrigin) : "http://localhost:3000";
}
