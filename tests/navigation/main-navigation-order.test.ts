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
    const inboxIndex = labels.indexOf("/novedades");
    const reservationsIndex = labels.indexOf("/reservations");
    const calendarIndex = labels.indexOf("/calendar");
    const tasksIndex = labels.indexOf("/tasks");
    const financeIndex = labels.indexOf("finance");
    const propertiesIndex = labels.indexOf("/properties");
    const integrationsIndex = labels.indexOf("/integrations");

    assert.ok(hoyIndex >= 0);
    assert.ok(inboxIndex > hoyIndex);
    assert.ok(reservationsIndex > inboxIndex);
    assert.ok(calendarIndex > reservationsIndex);
    assert.ok(tasksIndex > calendarIndex);
    assert.ok(financeIndex > tasksIndex);
    assert.ok(propertiesIndex > financeIndex);
    assert.ok(integrationsIndex > propertiesIndex);
  });
});
