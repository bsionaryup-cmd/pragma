import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAttentionItems } from "@/services/dashboard/operations-center.attention";

describe("operations center compose", () => {
  it("builds attention items from inbox and alerts", () => {
    const items = buildAttentionItems({
      commandCenter: {
        alerts: [
          {
            id: "cleaning",
            type: "cleaning",
            severity: "warning",
            messageKey: "dashboard.alerts.cleaningDelayed",
          },
        ],
        operational: {
          upcomingCheckIns: 0,
          upcomingCheckOuts: 0,
          activeReservations: 0,
          pendingCleaning: 2,
          incidents: 0,
          smartLockConfigured: true,
        },
      } as never,
      inboxAttentionCount: 3,
      smartAccessPending: 1,
      pendingIncome: 50000,
    });

    assert.ok(items.some((row) => row.kind === "messages" && row.count === 3));
    assert.ok(items.some((row) => row.kind === "cleaning" && row.count === 2));
    assert.ok(items.some((row) => row.kind === "ttlock"));
    assert.ok(items.some((row) => row.kind === "payment"));
  });
});
