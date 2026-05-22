import { PlatformRole } from "@prisma/client";
import { isPlatformOwnerEmail } from "@/lib/platform/platform-owner";

/** Assign SUPER_ADMIN_OWNER only when email matches configured platform owner. */
export function resolvePlatformRoleForEmail(email: string): PlatformRole {
  return isPlatformOwnerEmail(email)
    ? PlatformRole.SUPER_ADMIN_OWNER
    : PlatformRole.NONE;
}
