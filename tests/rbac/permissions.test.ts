import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRequiredPermissionForPath,
  hasPermission,
  hasRouteAccess,
  PROTECTED_DASHBOARD_PREFIXES,
} from "../../src/lib/auth/permissions";

describe("RBAC permissions", () => {
  it("admin can manage and delete users", () => {
    assert.equal(hasPermission("ADMIN", "users:write"), true);
    assert.equal(hasPermission("ADMIN", "users:delete"), true);
    assert.equal(hasPermission("RECEPTIONIST", "users:delete"), false);
  });

  it("admin has full billing and integrations access", () => {
    assert.equal(hasPermission("ADMIN", "billing:manage"), true);
    assert.equal(hasPermission("ADMIN", "integrations:manage"), true);
    assert.equal(hasPermission("ADMIN", "finance:revenue:read"), true);
  });

  it("receptionist is limited to operational scope", () => {
    assert.equal(hasPermission("RECEPTIONIST", "reservations:create"), true);
    assert.equal(hasPermission("RECEPTIONIST", "reservations:write"), false);
    assert.equal(hasPermission("RECEPTIONIST", "reservations:delete"), false);
    assert.equal(hasPermission("RECEPTIONIST", "finance:operations:read"), true);
    assert.equal(hasPermission("RECEPTIONIST", "finance:read"), false);
    assert.equal(hasPermission("RECEPTIONIST", "finance:revenue:read"), false);
    assert.equal(hasPermission("RECEPTIONIST", "billing:manage"), false);
    assert.equal(hasPermission("RECEPTIONIST", "integrations:read"), false);
    assert.equal(hasPermission("RECEPTIONIST", "settings:read"), false);
    assert.equal(hasPermission("RECEPTIONIST", "tasks:read"), false);
  });

  it("denies unknown protected routes by default", () => {
    assert.equal(getRequiredPermissionForPath("/unknown-admin"), null);
    assert.equal(hasRouteAccess("RECEPTIONIST", "/unknown-admin"), false);
  });

  it("allows receptionist finance via operations fallback", () => {
    assert.equal(hasRouteAccess("RECEPTIONIST", "/finance"), true);
    assert.equal(hasRouteAccess("RECEPTIONIST", "/revenue"), false);
    assert.equal(hasRouteAccess("RECEPTIONIST", "/settings/billing"), false);
    assert.equal(hasRouteAccess("RECEPTIONIST", "/users"), false);
    assert.equal(hasRouteAccess("RECEPTIONIST", "/integrations"), false);
  });

  it("maps write routes to explicit permissions", () => {
    assert.equal(getRequiredPermissionForPath("/reservations/new"), "reservations:create");
    assert.equal(getRequiredPermissionForPath("/settings/billing"), "billing:manage");
    assert.equal(getRequiredPermissionForPath("/revenue"), "finance:revenue:read");
  });

  it("protects core dashboard prefixes", () => {
    assert.ok(PROTECTED_DASHBOARD_PREFIXES.includes("/panel"));
    assert.ok(PROTECTED_DASHBOARD_PREFIXES.includes("/calendar"));
  });
});
