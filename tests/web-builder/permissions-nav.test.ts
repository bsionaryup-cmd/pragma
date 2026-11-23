import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRequiredPermissionForPath,
  hasPermission,
  hasRouteAccess,
} from "@/lib/auth/permissions";
import { getNavigationModulesForRole } from "@/lib/navigation";

describe("web-builder rbac", () => {
  it("maps /web-builder to website:read", () => {
    assert.equal(getRequiredPermissionForPath("/web-builder"), "website:read");
    assert.equal(
      getRequiredPermissionForPath("/web-builder/settings"),
      "website:read",
    );
  });

  it("allows ADMIN and blocks RECEPTIONIST", () => {
    assert.equal(hasPermission("ADMIN", "website:read"), true);
    assert.equal(hasPermission("ADMIN", "website:manage"), true);
    assert.equal(hasPermission("RECEPTIONIST", "website:read"), false);
    assert.equal(hasRouteAccess("RECEPTIONIST", "/web-builder"), false);
    assert.equal(hasRouteAccess("ADMIN", "/web-builder"), true);
  });

  it("exposes WEB BUILDER nav only for ADMIN", () => {
    const adminNav = getNavigationModulesForRole("ADMIN");
    const receptionNav = getNavigationModulesForRole("RECEPTIONIST");
    const adminHas = adminNav.some(
      (m) => m.type === "link" && m.href === "/web-builder",
    );
    const receptionHas = receptionNav.some(
      (m) => m.type === "link" && m.href === "/web-builder",
    );
    assert.equal(adminHas, true);
    assert.equal(receptionHas, false);
  });
});
