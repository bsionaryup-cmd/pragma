import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveOwnerDashboardAccess } from "@/lib/platform/owner-dashboard-access";

describe("resolveOwnerDashboardAccess", () => {
  it("allows active impersonation into tenant PMS", () => {
    const decision = resolveOwnerDashboardAccess({
      isImpersonating: true,
      hasOwnOrganization: true,
      expectsImpersonation: true,
    });
    assert.equal(decision.action, "allow-impersonation");
  });

  it("fails closed when impersonation was expected but cookie is missing", () => {
    const decision = resolveOwnerDashboardAccess({
      isImpersonating: false,
      hasOwnOrganization: true,
      expectsImpersonation: true,
    });
    assert.equal(decision.action, "redirect-impersonation-failed");
  });

  it("allows owner own-tenant PMS without impersonation", () => {
    const decision = resolveOwnerDashboardAccess({
      isImpersonating: false,
      hasOwnOrganization: true,
      expectsImpersonation: false,
    });
    assert.equal(decision.action, "allow-own-tenant");
  });

  it("sends owner without org home when not impersonating", () => {
    const decision = resolveOwnerDashboardAccess({
      isImpersonating: false,
      hasOwnOrganization: false,
      expectsImpersonation: false,
      isSelfServicePath: false,
    });
    assert.equal(decision.action, "redirect-owner-home");
  });
});
