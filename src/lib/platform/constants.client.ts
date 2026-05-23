/** Client-safe platform constants (no Prisma / server imports). */
export const PLATFORM_OWNER_EMAIL =
  process.env.NEXT_PUBLIC_PLATFORM_OWNER_EMAIL?.trim().toLowerCase() ||
  "bsionaryup@gmail.com";

export const OWNER_DASHBOARD_PATH = "/owner-dashboard";
export const OWNER_LOGIN_PATH = "/owner-login";
