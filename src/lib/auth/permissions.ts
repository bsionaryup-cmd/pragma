import type { AppUserRole } from "@/types/auth";

export type Permission =
  | "dashboard:read"
  | "properties:read"
  | "properties:write"
  | "reservations:read"
  | "reservations:write"
  | "reservations:delete"
  | "tasks:read"
  | "tasks:write"
  | "calendar:read"
  | "users:read"
  | "users:write"
  | "finance:read"
  | "finance:write"
  | "integrations:read"
  | "integrations:manage";

const ROLE_PERMISSIONS: Record<AppUserRole, readonly Permission[]> = {
  ADMIN: [
    "dashboard:read",
    "properties:read",
    "properties:write",
    "reservations:read",
    "reservations:write",
    "reservations:delete",
    "tasks:read",
    "tasks:write",
    "calendar:read",
    "users:read",
    "users:write",
    "finance:read",
    "finance:write",
    "integrations:read",
    "integrations:manage",
  ],
  RECEPTIONIST: [
    "dashboard:read",
    "properties:read",
    "reservations:read",
    "reservations:write",
    "tasks:read",
    "tasks:write",
    "calendar:read",
  ],
};

/** Ruta → permiso mínimo para acceder */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/panel": "dashboard:read",
  "/properties": "properties:read",
  "/reservations": "reservations:read",
  "/inbox": "reservations:read",
  "/integrations": "integrations:read",
  "/integrations/sire": "integrations:manage",
  "/integrations/traa": "integrations:manage",
  "/integrations/ttlock": "integrations:read",
  "/integrations/ttlock/connect": "integrations:manage",
  "/integrations/pricelabs": "integrations:read",
  "/revenue": "calendar:read",
  "/settings/billing": "dashboard:read",
  "/settings": "dashboard:read",
  "/tasks": "tasks:read",
  "/calendar": "calendar:read",
  "/users": "users:read",
  "/finance": "finance:read",
};

export function hasPermission(
  role: AppUserRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(role: AppUserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function getRequiredPermissionForPath(pathname: string): Permission | null {
  const match = Object.entries(ROUTE_PERMISSIONS)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) =>
      route === "/" ? pathname === "/" : pathname.startsWith(route),
    );

  return match?.[1] ?? null;
}

export function roleLabel(role: AppUserRole): string {
  return role === "ADMIN" ? "Administrador" : "Recepcionista";
}
