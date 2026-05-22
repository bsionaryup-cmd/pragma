import { PlatformRole } from "@prisma/client";
import { PLATFORM_OWNER_EMAIL, PLATFORM_SUPER_ADMIN_ROLE } from "@/lib/platform/constants";

type PlatformUserLike = {
  email: string;
  platformRole: PlatformRole;
};

export function isPlatformOwnerEmail(email: string): boolean {
  return email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
}

/** Validates DB role + email match — no hardcoded bypass without DB record. */
export function isSuperAdminOwner(user: PlatformUserLike): boolean {
  return (
    user.platformRole === PLATFORM_SUPER_ADMIN_ROLE &&
    isPlatformOwnerEmail(user.email)
  );
}

export function assertSuperAdminOwner(user: PlatformUserLike): void {
  if (!isSuperAdminOwner(user)) {
    throw new Error("Acceso denegado: se requiere rol SUPER_ADMIN_OWNER");
  }
}
