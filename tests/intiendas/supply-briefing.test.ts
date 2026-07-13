import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSupplyBriefing,
  explainRecommendation,
  mapVisualPriority,
  scoreSupplierOption,
  visualPriorityLabel,
} from "../../src/domains/retail-intelligence/lib/briefing";

describe("supply briefing", () => {
  it("builds actionable briefing without health metrics", () => {
    const briefing = buildSupplyBriefing({
      now: new Date("2026-07-13T15:00:00.000Z"),
      cashOpen: true,
      urgentOrderCount: 2,
      soonOrderCount: 1,
      waitSupplierNames: ["Alpina"],
      runningOutProductCount: 3,
      topUrgentSupplierName: "Coca Cola",
    });
    assert.match(briefing.greeting, /Buenos|Buenas/);
    assert.ok(briefing.lines.some((l) => /Aprobar 2/.test(l.text)));
    assert.equal(briefing.recommendedAction, "Revisar el pedido de Coca Cola.");
  });

  it("maps visual priority deterministically", () => {
    assert.equal(
      mapVisualPriority({ priority: "CRITICAL", daysOfCover: 2, leadTimeDays: 3 }),
      "URGENT",
    );
    assert.equal(
      mapVisualPriority({ priority: "MEDIUM", daysOfCover: 10, leadTimeDays: 3 }),
      "SOON",
    );
    assert.equal(visualPriorityLabel("NORMAL"), "Normal");
    assert.equal(visualPriorityLabel("SOON"), "Pronto");
  });

  it("explains buy recommendation", () => {
    const exp = explainRecommendation({
      action: "BUY_NOW",
      stock: 4,
      suggestedQty: 24,
      avgDailySales7: 8,
      leadTimeDays: 2,
      daysOfCover: 0.5,
      targetCoverDays: 7,
    });
    assert.equal(exp.decision, "Comprar ahora");
    assert.match(exp.motivo, /Rotación/);
    assert.ok(exp.details.some((d) => d.label === "IA recomienda" && d.value === "24"));
  });

  it("scores suppliers without randomness", () => {
    const fast = scoreSupplierOption({
      leadTimeDays: 1,
      cost: 1000,
      reliabilityScore: 0.9,
      onTimeRate: 0.9,
    });
    const slow = scoreSupplierOption({
      leadTimeDays: 10,
      cost: 1000,
      reliabilityScore: 0.9,
      onTimeRate: 0.9,
    });
    assert.ok(fast > slow);
  });
});
