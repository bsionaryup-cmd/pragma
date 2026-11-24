/**
 * Verificación estática de matriz RBAC.
 * Ejecutar: node scripts/verify-permissions.mjs
 * Keep in sync with src/lib/auth/permissions.ts
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
  ],
  RECEPTIONIST: [
    "dashboard:read",
    "reservations:read",
    "reservations:create",
    "reservations:write",
    "calendar:read",
  ],
};

const RECEPTIONIST_ROUTE_PREFIXES = [
  "/panel",
  "/calendar",
];

const ROUTE_PERMISSIONS = {
  "/panel": "dashboard:read",
  "/properties/new": "properties:write",
  "/properties": "properties:read",
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
  "/users": "users:read",
  "/onboarding": "billing:manage",
};

const EXPECTED_ACCESS = {
  ADMIN: [
    "/panel",
    "/properties",
    "/properties/new",
    "/calendar",
    "/finance",
    "/revenue",
    "/integrations",
    "/settings",
    "/settings/billing",
    "/users",
  ],
  RECEPTIONIST: [
    "/panel",
    "/calendar",
  ],
};

const EXPECTED_DENIED = {
  RECEPTIONIST: [
    "/revenue",
    "/integrations",
    "/settings",
    "/settings/billing",
    "/users",
    "/finance",
    "/finance/payment-links",
    "/finance/payment-history",
    "/properties",
    "/properties/new",
    "/reservations",
    "/reservations/new",
    "/inbox",
    "/tasks",
    "/tasks/new",
  ],
};

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

function receptionistRouteAllowed(pathname) {
  return RECEPTIONIST_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getRequiredPermission(pathname) {
  const match = Object.entries(ROUTE_PERMISSIONS)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) => pathname.startsWith(route));
  return match?.[1] ?? null;
}

function hasRouteAccess(role, pathname) {
  if (role === "RECEPTIONIST" && !receptionistRouteAllowed(pathname)) {
    return false;
  }
  const permission = getRequiredPermission(pathname);
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

let failed = 0;

for (const [role, paths] of Object.entries(EXPECTED_ACCESS)) {
  for (const path of paths) {
    if (!hasRouteAccess(role, path)) {
      console.error(`FAIL: ${role} should access ${path}`);
      failed += 1;
    }
  }
}

for (const [role, paths] of Object.entries(EXPECTED_DENIED)) {
  for (const path of paths) {
    if (hasRouteAccess(role, path)) {
      console.error(`FAIL: ${role} should NOT access ${path}`);
      failed += 1;
    }
  }
}

if (failed > 0) {
  console.error(`\nverify-permissions: ${failed} failure(s)`);
  process.exit(1);
}

console.log("verify-permissions: ok");
