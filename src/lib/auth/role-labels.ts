import type { AppUserRole } from "@/types/auth";
import { PLATFORM_OWNER_EMAIL } from "@/lib/platform/constants";

type RoleLabelUser = {
  email: string;
  role: string;
  platformRole?: string;
};

export function isSuperAdminOwnerLike(user: RoleLabelUser): boolean {
  return (
    user.platformRole === "SUPER_ADMIN_OWNER" &&
    user.email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL
  );
}

export function tenantRoleLabel(role: AppUserRole): string {
  return role === "ADMIN" ? "Administrador" : "Recepcionista";
}

export function displayRoleLabel(
  user: RoleLabelUser,
  effectiveTenantRole?: AppUserRole,
): string {
  if (isSuperAdminOwnerLike(user)) {
    return effectiveTenantRole
      ? `Super Admin · vista ${tenantRoleLabel(effectiveTenantRole)}`
      : "Super Admin Owner";
  }
  return tenantRoleLabel(user.role as AppUserRole);
}

export function roleLabel(role: AppUserRole): string {
  return tenantRoleLabel(role);
}
