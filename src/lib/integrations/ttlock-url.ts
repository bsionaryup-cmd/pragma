export const TTLOCK_CALLBACK_PATH = "/api/integrations/ttlock/callback";

/** Canonical production callback — source of truth for TTLock Open Platform. */
export const PRAGMA_CANONICAL_APP_ORIGIN = "https://pragma-pms.vercel.app";
export const PRAGMA_CANONICAL_TTLOCK_CALLBACK = `${PRAGMA_CANONICAL_APP_ORIGIN}${TTLOCK_CALLBACK_PATH}`;

export type TTLockCallbackValidation = {
  valid: boolean;
  isPublic: boolean;
  issues: string[];
  normalizedUrl: string | null;
};

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production"
  );
}

/** Join origin + path without double slashes. */
export function joinOriginAndPath(origin: string, pathname: string): string {
  const base = origin.trim();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;

  try {
    const url = new URL(base.includes("://") ? base : `https://${base}`);
    url.pathname = path;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    const cleanOrigin = base.replace(/\/+$/, "");
    const cleanPath = path.replace(/^\/+/, "/");
    return `${cleanOrigin}${cleanPath}`;
  }
}

export function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }
  if (host.endsWith(".localhost")) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

/** Tunnels / preview hosts must not be used for TTLock OAuth in production. */
export function isEphemeralOAuthHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return true;
  if (isLocalOrPrivateHost(host)) return true;
  if (host.includes("ngrok")) return true;
  if (host.endsWith(".vercel.app") && host !== "pragma-pms.vercel.app") {
    return true;
  }
  return false;
}

function isAcceptableEnvCallbackSource(uri: string): boolean {
  try {
    const host = new URL(uri).hostname;
    if (isProductionRuntime() && isEphemeralOAuthHost(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeTTLockCallbackUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    if (
      isProductionRuntime() &&
      url.hostname === new URL(PRAGMA_CANONICAL_APP_ORIGIN).hostname
    ) {
      return PRAGMA_CANONICAL_TTLOCK_CALLBACK;
    }
    url.pathname = TTLOCK_CALLBACK_PATH;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return joinOriginAndPath(trimmed, TTLOCK_CALLBACK_PATH);
  }
}

export function buildTTLockCallbackFromOrigin(origin: string): string {
  try {
    const url = new URL(origin.trim());
    if (
      isProductionRuntime() &&
      url.hostname === new URL(PRAGMA_CANONICAL_APP_ORIGIN).hostname
    ) {
      return PRAGMA_CANONICAL_TTLOCK_CALLBACK;
    }
    url.pathname = TTLOCK_CALLBACK_PATH;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return joinOriginAndPath(origin, TTLOCK_CALLBACK_PATH);
  }
}

export function buildTTLockCallbackFromInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.pathname.includes("ttlock/callback")) {
      return normalizeTTLockCallbackUri(trimmed);
    }
    return buildTTLockCallbackFromOrigin(url.origin);
  } catch {
    return buildTTLockCallbackFromOrigin(trimmed);
  }
}

export function validateTTLockCallbackUrl(uri: string): TTLockCallbackValidation {
  if (!uri?.trim()) {
    return {
      valid: false,
      isPublic: false,
      issues: ["Callback URL vacía"],
      normalizedUrl: null,
    };
  }

  const issues: string[] = [];

  try {
    const normalized = normalizeTTLockCallbackUri(uri);
    const url = new URL(normalized);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      issues.push("Protocolo inválido (usa https:// en producción)");
    }

    if (url.protocol !== "https:" && isProductionRuntime()) {
      issues.push("En producción el callback debe usar HTTPS");
    }

    if (url.pathname !== TTLOCK_CALLBACK_PATH) {
      issues.push(`Ruta incorrecta (debe ser ${TTLOCK_CALLBACK_PATH})`);
    }

    if (normalized.includes("//api")) {
      issues.push("URL malformada (doble slash en la ruta)");
    }

    if (isEphemeralOAuthHost(url.hostname)) {
      issues.push(
        `Host no válido para TTLock en producción. Usa ${PRAGMA_CANONICAL_TTLOCK_CALLBACK}`,
      );
    }

    if (
      isProductionRuntime() &&
      normalized !== PRAGMA_CANONICAL_TTLOCK_CALLBACK &&
      url.hostname === new URL(PRAGMA_CANONICAL_APP_ORIGIN).hostname
    ) {
      issues.push(
        `Usa la callback canónica: ${PRAGMA_CANONICAL_TTLOCK_CALLBACK}`,
      );
    }

    return {
      valid: issues.length === 0,
      isPublic: !isEphemeralOAuthHost(url.hostname),
      issues,
      normalizedUrl:
        issues.length === 0 &&
        url.hostname === new URL(PRAGMA_CANONICAL_APP_ORIGIN).hostname
          ? PRAGMA_CANONICAL_TTLOCK_CALLBACK
          : normalized,
    };
  } catch {
    return {
      valid: false,
      isPublic: false,
      issues: ["URL de callback malformada"],
      normalizedUrl: null,
    };
  }
}

function resolvePublicCallbackFromEnv(): { uri: string; source: string } | null {
  const explicit = process.env.TTLOCK_REDIRECT_URI?.trim();
  if (explicit) {
    const uri = buildTTLockCallbackFromInput(explicit);
    if (isAcceptableEnvCallbackSource(uri)) {
      return { uri, source: "TTLOCK_REDIRECT_URI" };
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const uri = buildTTLockCallbackFromInput(appUrl);
    if (isAcceptableEnvCallbackSource(uri)) {
      return { uri, source: "NEXT_PUBLIC_APP_URL" };
    }
  }

  const legacyAppUrl = process.env.APP_URL?.trim();
  if (legacyAppUrl) {
    const uri = buildTTLockCallbackFromInput(legacyAppUrl);
    if (isAcceptableEnvCallbackSource(uri)) {
      return { uri, source: "APP_URL" };
    }
  }

  if (isProductionRuntime()) {
    return {
      uri: PRAGMA_CANONICAL_TTLOCK_CALLBACK,
      source: "canonical_production",
    };
  }

  return null;
}

export type ResolvedTTLockRedirect = {
  redirectUri: string;
  source: string;
  validation: TTLockCallbackValidation;
};

/**
 * Canonical redirect_uri for TTLock OAuth (authorize + token + UI).
 * Production default: https://pragma-pms.vercel.app/api/integrations/ttlock/callback
 */
export function resolveTTLockRedirectUri(options?: {
  storedRedirectUri?: string | null;
}): ResolvedTTLockRedirect {
  const fromEnv = resolvePublicCallbackFromEnv();
  if (fromEnv) {
    const validation = validateTTLockCallbackUrl(fromEnv.uri);
    return {
      redirectUri: validation.normalizedUrl ?? fromEnv.uri,
      source: fromEnv.source,
      validation,
    };
  }

  const stored = options?.storedRedirectUri?.trim();
  if (stored) {
    const redirectUri = normalizeTTLockCallbackUri(stored);
    const validation = validateTTLockCallbackUrl(redirectUri);
    if (validation.valid) {
      return { redirectUri, source: "stored", validation };
    }
  }

  if (isProductionRuntime()) {
    const validation = validateTTLockCallbackUrl(PRAGMA_CANONICAL_TTLOCK_CALLBACK);
    return {
      redirectUri: PRAGMA_CANONICAL_TTLOCK_CALLBACK,
      source: "canonical_production",
      validation,
    };
  }

  return {
    redirectUri: "",
    source: "unconfigured",
    validation: {
      valid: false,
      isPublic: false,
      issues: [
        `Configura TTLOCK_REDIRECT_URI o NEXT_PUBLIC_APP_URL (${PRAGMA_CANONICAL_APP_ORIGIN}).`,
      ],
      normalizedUrl: null,
    },
  };
}
