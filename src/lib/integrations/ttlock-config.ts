import type { TTLockEnvironment } from "@prisma/client";
import {
  buildTTLockCallbackFromInput,
  getTTLockOAuthRedirectUri,
  normalizeTTLockCallbackUri,
  PRAGMA_CANONICAL_TTLOCK_CALLBACK,
  PRAGMA_TTLOCK_COOKIE_DOMAIN,
  resolveTTLockAppRedirectUrl,
  resolveTTLockRedirectUri,
  type ResolvedTTLockRedirect,
  type TTLockCallbackValidation,
  validateTTLockCallbackUrl,
} from "@/lib/integrations/ttlock-url";

export { PRAGMA_CANONICAL_TTLOCK_CALLBACK, PRAGMA_TTLOCK_COOKIE_DOMAIN };
export { getTTLockOAuthRedirectUri, resolveTTLockAppRedirectUrl };

export type { TTLockCallbackValidation, ResolvedTTLockRedirect };
export {
  normalizeTTLockCallbackUri as normalizeRedirectUri,
  resolveTTLockRedirectUri,
  validateTTLockCallbackUrl,
};

const TTLOCK_API_BASE: Record<TTLockEnvironment, string> = {
  PRODUCTION: "https://euapi.ttlock.com",
  SANDBOX: "https://euapi.ttlock.com",
};

const TTLOCK_OAUTH_WEB_BASE: Record<TTLockEnvironment, string> = {
  PRODUCTION: "https://euopen.ttlock.com",
  SANDBOX: "https://euopen.ttlock.com",
};

/** @deprecated Use resolveTTLockRedirectUri — ignores request to avoid localhost. */
export type TTLockRequestContext = {
  requestOrigin?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
};

export function getTTLockCallbackUrl(
  _request?: TTLockRequestContext,
  storedRedirectUri?: string | null,
): string {
  const resolved = resolveTTLockRedirectUri({ storedRedirectUri });
  return resolved.validation.normalizedUrl ?? resolved.redirectUri;
}

export function resolveRequestContextFromHeaders(
  headers: Headers,
  fallbackOrigin?: string | null,
): TTLockRequestContext {
  return {
    requestOrigin: fallbackOrigin ?? null,
    forwardedHost: headers.get("x-forwarded-host"),
    forwardedProto: headers.get("x-forwarded-proto"),
  };
}

export function resolveRequestContextFromRequest(
  request: Request,
): TTLockRequestContext {
  return resolveRequestContextFromHeaders(
    request.headers,
    new URL(request.url).origin,
  );
}

export function getTTLockApiBaseUrl(environment: TTLockEnvironment): string {
  const override = process.env.TTLOCK_API_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  return TTLOCK_API_BASE[environment];
}

export function getTTLockOAuthWebBaseUrl(environment: TTLockEnvironment): string {
  const override = process.env.TTLOCK_OAUTH_WEB_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  return TTLOCK_OAUTH_WEB_BASE[environment];
}

export function getTTLockOAuthTokenUrl(environment: TTLockEnvironment): string {
  return `${getTTLockApiBaseUrl(environment)}/oauth2/token`;
}

export function getTTLockOAuthAuthorizeUrl(
  environment: TTLockEnvironment,
  params: { clientId: string; state: string },
): string {
  const redirectUri = getTTLockOAuthRedirectUri();
  const base = getTTLockOAuthWebBaseUrl(environment);
  const search = new URLSearchParams();
  search.set("client_id", params.clientId.trim());
  search.set("response_type", "code");
  search.set("redirect_uri", redirectUri);
  search.set("state", params.state);
  return `${base}/oauth2/authorize?${search.toString()}`;
}

export function getTTLockLockListUrl(environment: TTLockEnvironment): string {
  return `${getTTLockApiBaseUrl(environment)}/v3/lock/list`;
}

export function getTTLockKeyboardPwdAddUrl(environment: TTLockEnvironment): string {
  return `${getTTLockApiBaseUrl(environment)}/v3/keyboardPwd/add`;
}

export function getTTLockKeyboardPwdDeleteUrl(environment: TTLockEnvironment): string {
  return `${getTTLockApiBaseUrl(environment)}/v3/keyboardPwd/delete`;
}

export function isTTLockBrowserOAuthEnabled(): boolean {
  if (process.env.TTLOCK_BROWSER_OAUTH === "false") return false;
  if (process.env.TTLOCK_BROWSER_OAUTH === "true") return true;
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production"
  );
}
