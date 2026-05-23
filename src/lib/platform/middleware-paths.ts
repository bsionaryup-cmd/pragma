/**
 * Edge-safe route constants for proxy/middleware.
 * Do not import @/lib/platform/constants here — it is shared with server code
 * and must stay free of anything that could pull Prisma into the Edge bundle.
 */

export const OWNER_DASHBOARD_PATH = "/owner-dashboard";

export const OWNER_LOGIN_PATH = "/owner-login";

export const PLATFORM_OWNER_API_PREFIX = "/api/owner";
