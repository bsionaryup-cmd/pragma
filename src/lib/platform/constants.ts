/** Canonical platform owner email — override via PLATFORM_OWNER_EMAIL env. */
export const PLATFORM_OWNER_EMAIL =
  process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() ||
  "bsionaryup@gmail.com";

/** Matches PlatformRole.SUPER_ADMIN_OWNER in the database. */
export const PLATFORM_SUPER_ADMIN_ROLE = "SUPER_ADMIN_OWNER" as const;

/** Impersonation session TTL (ms). Default 2 hours. */
export const PLATFORM_IMPERSONATION_TTL_MS = Number(
  process.env.PLATFORM_IMPERSONATION_TTL_MS ?? 2 * 60 * 60 * 1000,
);

export const PLATFORM_IMPERSONATION_COOKIE = "pragma_platform_impersonation";

export const OWNER_DASHBOARD_PATH = "/owner-dashboard";

export const OWNER_LOGIN_PATH = "/owner-login";

export const PLATFORM_OWNER_API_PREFIX = "/api/owner";
