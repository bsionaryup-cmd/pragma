/** Client-safe platform constants (no Prisma / server imports). */
export const PLATFORM_OWNER_EMAIL =
  process.env.NEXT_PUBLIC_PLATFORM_OWNER_EMAIL?.trim().toLowerCase() ||
  "bsionaryup@gmail.com";

export const OWNER_DASHBOARD_PATH = "/owner-dashboard";
export const OWNER_LOGIN_PATH = "/owner-login";

/**
 * Pilot PMS tenant (URBA Nova Loft / urbanovaloft).
 * Owner "PMS" entry impersonates this org — never opens bare /panel as platform home.
 */
export const PILOT_PMS_ORGANIZATION_ID = "cmplxfg0a000105jrs0gqtwyc";
