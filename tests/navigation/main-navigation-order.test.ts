import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNavigationModulesForRole } from "@/lib/navigation";

describe("main navigation order", () => {
  it("lists operational modules in host workflow order", () => {
    const modules = getNavigationModulesForRole("ADMIN", "PRO");
    const labels = modules.map((module) =>
      module.type === "link" ? module.href : module.id,
    );

    const hoyIndex = labels.indexOf("/panel");
    const calendarIndex = labels.indexOf("/calendar");
    const financeIndex = labels.indexOf("finance");
    const propertiesIndex = labels.indexOf("/properties");
    const integrationsIndex = labels.indexOf("/integrations");

    assert.ok(hoyIndex >= 0);
    assert.ok(calendarIndex > hoyIndex);
    assert.ok(financeIndex > calendarIndex);
    assert.ok(propertiesIndex > financeIndex);
    assert.ok(integrationsIndex > propertiesIndex);
    assert.equal(labels.includes("/reservations"), false);
    assert.equal(labels.includes("/novedades"), false);
    assert.equal(labels.includes("/inbox"), false);
  });
});
