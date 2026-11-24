import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNavigationModulesForRole } from "@/lib/navigation";

describe("PMS nav Master Simplification", () => {
  it("hides retired modules: novedades, reservations, tasks", () => {
    const adminNav = getNavigationModulesForRole("ADMIN");
    const hrefs = adminNav
      .filter((m) => m.type === "link")
      .map((m) => m.href);

    assert.equal(hrefs.includes("/novedades"), false);
    assert.equal(hrefs.includes("/reservations"), false);
    assert.equal(hrefs.includes("/tasks"), false);
    assert.equal(hrefs.includes("/inbox"), false);
  });

  it("keeps core surfaces + WEB BUILDER", () => {
    const adminNav = getNavigationModulesForRole("ADMIN");
    const hrefs = adminNav
      .filter((m) => m.type === "link")
      .map((m) => m.href);

    assert.equal(hrefs.includes("/panel"), true);
    assert.equal(hrefs.includes("/calendar"), true);
    assert.equal(hrefs.includes("/properties"), true);
    assert.equal(hrefs.includes("/web-builder"), true);
    assert.equal(hrefs.includes("/integrations"), true);
    assert.equal(hrefs.includes("/smart-access"), true);
  });
});
