import type { AppUserRole } from "@/types/auth";

/**
 * RBAC dentro del tenant (organización).
 * - ADMIN: administrador con acceso completo al panel del tenant.
 * - RECEPTIONIST: operación diaria con permisos limitados.
 *
 * El rol SUPER_ADMIN_OWNER vive en User.platformRole (fuera del tenant).
 * Ver src/lib/auth/role-definitions.server.ts para pantallas por tipo de cuenta.
 */

export type Permission =
  | "dashboard:read"
  | "properties:read"
  | "properties:write"
  | "reservations:read"
  | "reservations:create"
  | "reservations:write"
  | "reservations:delete"
  | "calendar:read"
  | "tasks:read"
  | "tasks:write"
  | "users:read"
  | "users:write"
  | "users:delete"
  | "finance:read"
  | "finance:operations:read"
  | "finance:write"
  | "finance:revenue:read"
  | "billing:read"
  | "billing:manage"
  | "integrations:read"
  | "integrations:manage"
  | "access:read"
  | "access:manage"
  | "settings:read"
  | "pricing:read";

const ALL_PERMISSIONS: Permission[] = [
  "dashboard:read",
  "properties:read",
  "properties:write",
  "reservations:read",
  "reservations:create",
  "reservations:write",
  "reservations:delete",
  "calendar:read",
  "tasks:read",
  "tasks:write",
  "users:read",
  "users:write",
  "users:delete",
  "finance:read",
  "finance:operations:read",
  "finance:write",
  "finance:revenue:read",
  "billing:read",
  "billing:manage",
  "integrations:read",
  "integrations:manage",
  "access:read",
  "access:manage",
  "settings:read",
  "pricing:read",
];

const ROLE_PERMISSIONS: Record<AppUserRole, readonly Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  RECEPTIONIST: [
    "dashboard:read",
    "reservations:read",
    "reservations:create",
    "reservations:write",
    "calendar:read",
    "tasks:read",
    "tasks:write",
  ],
};

/** Rutas permitidas para recepcionista (operación diaria). */
export const RECEPTIONIST_ROUTE_PREFIXES = [
  "/panel",
  "/reservations",
  "/novedades",
  "/calendar",
  "/tasks",
] as const;

/** Ruta → permiso mínimo para acceder */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/panel": "dashboard:read",
  "/properties/new": "properties:write",
  "/properties": "properties:read",
  "/reservations/new": "reservations:create",
  "/reservations": "reservations:read",
  "/novedades": "reservations:read",
  "/inbox": "reservations:read",
  "/calendar": "calendar:read",
  "/revenue": "finance:revenue:read",
  "/finance": "finance:read",
  "/finance/payment-links": "finance:read",
  "/finance/payment-history": "finance:read",
  "/integrations/airbnb": "integrations:read",
  "/integrations/sire": "integrations:manage",
  "/integrations/traa": "integrations:manage",
  "/integrations/ttlock/connect": "integrations:manage",
  "/integrations/ttlock": "integrations:read",
  "/integrations/pricelabs": "integrations:read",
  "/integrations/wompi": "integrations:read",
  "/integrations": "integrations:read",
  "/prospecting": "integrations:read",
  "/smart-access": "access:read",
  "/settings/billing": "billing:manage",
  "/settings": "settings:read",
  "/tasks/new": "tasks:write",
  "/tasks": "tasks:read",
  "/users": "users:read",
  "/onboarding": "billing:manage",
};

export const PROTECTED_DASHBOARD_PREFIXES = [
  "/panel",
  "/calendar",
  "/reservations",
  "/properties",
  "/finance",
  "/revenue",
  "/smart-access",
  "/integrations",
  "/prospecting",
  "/settings",
  "/users",
  "/tasks",
  "/inbox",
  "/onboarding",
] as const;

export function isProtectedDashboardPath(pathname: string): boolean {
  return PROTECTED_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function hasPermission(
  role: AppUserRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: AppUserRole,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
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

function receptionistRouteAllowed(pathname: string): boolean {
  return RECEPTIONIST_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Route access with partial finance fallback for receptionist operations view. */
export function hasRouteAccess(role: AppUserRole, pathname: string): boolean {
  if (role === "RECEPTIONIST" && !receptionistRouteAllowed(pathname)) {
    return false;
  }

  const permission = getRequiredPermissionForPath(pathname);
  if (!permission) return false;

  if (hasPermission(role, permission)) return true;

  if (
    permission === "finance:read" &&
    hasPermission(role, "finance:operations:read")
  ) {
    return true;
  }

  return false;
}

export function roleLabel(role: AppUserRole): string {
  return role === "ADMIN" ? "Administrador" : "Recepcionista";
}
