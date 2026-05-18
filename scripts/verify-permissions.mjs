/**
 * Verificación estática de matriz de permisos (MVP stabilization).
 * Ejecutar: node scripts/verify-permissions.mjs
 */

const ROLE_PERMISSIONS = {
  ADMIN: [
    "dashboard:read",
    "properties:read",
    "properties:write",
    "reservations:read",
    "reservations:write",
    "tasks:read",
    "tasks:write",
    "calendar:read",
    "users:read",
    "users:write",
  ],
  OPERATIONS: [
    "dashboard:read",
    "reservations:read",
    "tasks:read",
    "tasks:write",
    "calendar:read",
  ],
};

const ROUTE_PERMISSIONS = {
  "/": "dashboard:read",
  "/properties": "properties:read",
  "/reservations": "reservations:read",
  "/tasks": "tasks:read",
  "/calendar": "calendar:read",
  "/users": "users:read",
};

const NAV = [
  { href: "/", permission: "dashboard:read" },
  { href: "/properties", permission: "properties:read" },
  { href: "/reservations", permission: "reservations:read" },
  { href: "/calendar", permission: "calendar:read" },
  { href: "/tasks", permission: "tasks:read" },
  { href: "/users", permission: "users:read" },
];

const WRITE_ROUTE_PERMISSIONS = {
  "/properties/new": "properties:write",
  "/reservations/new": "reservations:write",
  "/tasks/new": "tasks:write",
};

/** Rutas que cada rol debe poder abrir (middleware + layouts) */
const EXPECTED_ACCESS = {
  ADMIN: [
    "/",
    "/properties",
    "/properties/new",
    "/reservations",
    "/reservations/new",
    "/tasks",
    "/tasks/new",
    "/calendar",
    "/users",
  ],
  OPERATIONS: ["/", "/reservations", "/tasks", "/tasks/new", "/calendar"],
};

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

function getRequiredPermission(pathname) {
  const match = Object.entries(ROUTE_PERMISSIONS)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) =>
      route === "/" ? pathname === "/" : pathname.startsWith(route),
    );
  return match?.[1] ?? null;
}

function canAccessPath(role, pathname) {
  const readPerm = getRequiredPermission(pathname);
  const writePerm = WRITE_ROUTE_PERMISSIONS[pathname];
  if (readPerm && !hasPermission(role, readPerm)) return false;
  if (writePerm && !hasPermission(role, writePerm)) return false;
  return true;
}

function getNavForRole(role) {
  return NAV.filter((item) => hasPermission(role, item.permission));
}

let failed = 0;

for (const role of ["ADMIN", "OPERATIONS"]) {
  const nav = getNavForRole(role).map((n) => n.href);
  console.log(`\n[${role}] menú: ${nav.join(", ")}`);

  const expected = EXPECTED_ACCESS[role];
  const allPaths = [
    ...new Set([
      ...EXPECTED_ACCESS.ADMIN,
      ...EXPECTED_ACCESS.OPERATIONS,
    ]),
  ];

  for (const path of allPaths) {
    const allowed = canAccessPath(role, path);
    const shouldAllow = expected.includes(path);
    if (allowed !== shouldAllow) {
      console.log(
        `  ✗ ${path}: esperado ${shouldAllow ? "permitido" : "bloqueado"}, obtuvo ${allowed ? "permitido" : "bloqueado"}`,
      );
      failed++;
    }
  }
}

if (getNavForRole("ADMIN").length !== 6) {
  console.error("ADMIN: menú debe tener 6 ítems");
  failed++;
}
if (getNavForRole("OPERATIONS").length !== 4) {
  console.error("OPERATIONS: menú debe tener 4 ítems");
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("\n✓ Matriz de permisos y navegación coherentes");
