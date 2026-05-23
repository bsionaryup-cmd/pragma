import "server-only";

import type { User } from "@prisma/client";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { OWNER_DASHBOARD_PATH, OWNER_LOGIN_PATH } from "@/lib/platform/constants";

/** Cuenta de plataforma — fuera del tenant. Solo bsionaryup@gmail.com con rol DB. */
export type PlatformAccountKind = "SUPER_ADMIN_OWNER";

/** Cuenta dentro de un tenant (organización). */
export type TenantAccountKind = "TENANT_ADMIN" | "TENANT_RECEPTIONIST";

export type AccountKind = PlatformAccountKind | TenantAccountKind;

export type RoleScreenDefinition = {
  kind: AccountKind;
  homePath: string;
  panelPath: string;
  label: string;
  description: string;
  screens: readonly string[];
};

const TENANT_ADMIN_SCREENS = [
  "/panel",
  "/calendar",
  "/reservations",
  "/properties",
  "/finance",
  "/revenue",
  "/integrations",
  "/settings",
  "/users",
  "/tasks",
  "/inbox",
  "/onboarding",
] as const;

const TENANT_RECEPTIONIST_SCREENS = [
  "/panel",
  "/calendar",
  "/reservations",
  "/properties",
  "/finance",
  "/inbox",
] as const;

const PLATFORM_OWNER_SCREENS = [
  OWNER_DASHBOARD_PATH,
  `${OWNER_DASHBOARD_PATH}/tenant/[id]`,
  "/owner-login",
] as const;

export const ROLE_SCREEN_DEFINITIONS: Record<AccountKind, RoleScreenDefinition> = {
  SUPER_ADMIN_OWNER: {
    kind: "SUPER_ADMIN_OWNER",
    homePath: OWNER_DASHBOARD_PATH,
    panelPath: "/panel",
    label: "Super Admin Owner",
    description:
      "Dueño de plataforma. Ve todos los tenants en el Owner Dashboard. Accede al PMS solo por impersonación segura.",
    screens: PLATFORM_OWNER_SCREENS,
  },
  TENANT_ADMIN: {
    kind: "TENANT_ADMIN",
    homePath: "/panel",
    panelPath: "/panel",
    label: "Administrador",
    description:
      "Dueño o administrador del tenant. Acceso completo al panel de control, equipo, facturación e integraciones.",
    screens: TENANT_ADMIN_SCREENS,
  },
  TENANT_RECEPTIONIST: {
    kind: "TENANT_RECEPTIONIST",
    homePath: "/panel",
    panelPath: "/panel",
    label: "Recepcionista",
    description:
      "Operación diaria: reservas, calendario, propiedades (lectura) y finanzas operativas.",
    screens: TENANT_RECEPTIONIST_SCREENS,
  },
};

function userNeedsOnboarding(user: {
  role: string;
  onboardingCompletedAt: Date | null;
}): boolean {
  return user.role === "ADMIN" && !user.onboardingCompletedAt;
}

export function resolveAccountKind(user: User): AccountKind {
  if (isSuperAdminOwner(user)) {
    return "SUPER_ADMIN_OWNER";
  }
  if (user.role === "ADMIN") {
    return "TENANT_ADMIN";
  }
  return "TENANT_RECEPTIONIST";
}

export function getRoleScreenDefinition(user: User): RoleScreenDefinition {
  return ROLE_SCREEN_DEFINITIONS[resolveAccountKind(user)];
}

/** Ruta de inicio tras login o onboarding según tipo de cuenta. */
export function resolvePostAuthHomePath(user: User): string {
  if (isSuperAdminOwner(user)) {
    return OWNER_DASHBOARD_PATH;
  }
  if (userNeedsOnboarding(user)) {
    return "/onboarding";
  }
  return "/panel";
}
