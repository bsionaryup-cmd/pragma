/**
 * Verificación estática de matriz RBAC.
 * Ejecutar: node scripts/verify-permissions.mjs
 */

const ROLE_PERMISSIONS = {
  ADMIN: [
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
    "settings:read",
    "pricing:read",
  ],
  RECEPTIONIST: [
    "dashboard:read",
    "properties:read",
    "reservations:read",
    "reservations:create",
    "calendar:read",
    "finance:operations:read",
  ],
};

const ROUTE_PERMISSIONS = {
  "/panel": "dashboard:read",
  "/properties/new": "properties:write",
  "/properties": "properties:read",
  "/reservations/new": "reservations:create",
  "/reservations": "reservations:read",
  "/calendar": "calendar:read",
  "/revenue": "finance:revenue:read",
  "/finance": "finance:read",
  "/integrations": "integrations:read",
  "/settings/billing": "billing:manage",
  "/settings": "settings:read",
  "/users": "users:read",
  "/tasks": "tasks:read",
};

const EXPECTED_ACCESS = {
  ADMIN: [
    "/panel",
    "/properties",
    "/properties/new",
    "/reservations",
    "/reservations/new",
    "/calendar",
    "/finance",
    "/revenue",
    "/integrations",
    "/settings",
    "/settings/billing",
    "/users",
    "/tasks",
  ],
  RECEPTIONIST: [
    "/panel",
    "/properties",
    "/reservations",
    "/reservations/new",
    "/calendar",
    "/finance",
  ],
};

const EXPECTED_DENIED = {
  RECEPTIONIST: [
    "/revenue",
    "/integrations",
    "/settings",
    "/settings/billing",
    "/users",
    "/tasks",
    "/properties/new",
  ],
};

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

function getRequiredPermission(pathname) {
  const match = Object.entries(ROUTE_PERMISSIONS)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) => pathname.startsWith(route));
  return match?.[1] ?? null;
}

function hasRouteAccess(role, pathname) {
  const permission = getRequiredPermission(pathname);
  if (!permission) return false;
  if (hasPermission(role, permission)) return true;
  if (permission === "finance:read" && hasPermission(role, "finance:operations:read")) {
    return true;
  }
  return false;
}

let failed = 0;

for (const role of Object.keys(EXPECTED_ACCESS)) {
  for (const path of EXPECTED_ACCESS[role]) {
    if (!hasRouteAccess(role, path)) {
      console.log(`✗ ${role} should access ${path}`);
      failed++;
    }
  }
}

for (const path of EXPECTED_DENIED.RECEPTIONIST) {
  if (hasRouteAccess("RECEPTIONIST", path)) {
    console.log(`✗ RECEPTIONIST should NOT access ${path}`);
    failed++;
  }
}

if (hasPermission("RECEPTIONIST", "reservations:write")) {
  console.log("✗ RECEPTIONIST must not have reservations:write");
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("\n✓ Matriz RBAC coherente (ADMIN / RECEPTIONIST)");
