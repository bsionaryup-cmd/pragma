import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeFinancePlanningSnapshot } from "@/lib/finance/finance-planning-calc";

describe("finance-planning-calc", () => {
  const formatAmount = (amount: number) => `$${amount}`;

  it("calcula ingresos requeridos con costos fijos y meta", () => {
    const snapshot = computeFinancePlanningSnapshot({
      settings: {
        fixedExpenses: [
          { name: "Arriendo", amount: 3_000_000 },
          { name: "Servicios", amount: 900_000 },
        ],
        variableExpenses: [],
        monthlyProfitGoal: 8_000_000,
      },
      currentRevenue: 10_000_000,
      currentOccupancyPct: 58,
      occupiedNights: 18,
      availableNights: 31,
      bookingCount: 6,
      formatAmount,
    });

    assert.equal(snapshot.totalFixedCost, 3_900_000);
    assert.equal(snapshot.requiredRevenue, 11_900_000);
    assert.equal(snapshot.remainingToGoal, 1_900_000);
  });

  it("resuelve costos variables porcentuales sin persistir", () => {
    const snapshot = computeFinancePlanningSnapshot({
      settings: {
        fixedExpenses: [{ name: "Base", amount: 1_000_000 }],
        variableExpenses: [{ name: "Comisión", type: "percent", value: 10 }],
        monthlyProfitGoal: 1_000_000,
      },
      currentRevenue: 2_000_000,
      currentOccupancyPct: 40,
      occupiedNights: 10,
      availableNights: 30,
      bookingCount: 4,
      formatAmount,
    });

    assert.equal(snapshot.requiredRevenue, 2_222_222);
    assert.equal(snapshot.totalVariableCost, 222_222);
  });

  it("calcula ocupación objetivo usando ADR derivado", () => {
    const snapshot = computeFinancePlanningSnapshot({
      settings: {
        fixedExpenses: [{ name: "Fijo", amount: 5_000_000 }],
        variableExpenses: [],
        monthlyProfitGoal: 3_000_000,
      },
      currentRevenue: 8_000_000,
      currentOccupancyPct: 50,
      occupiedNights: 16,
      availableNights: 30,
      bookingCount: 5,
      formatAmount,
    });

    assert.equal(snapshot.estimatedAdr, 500_000);
    assert.equal(snapshot.expectedMonthCapacity, 15_000_000);
    assert.equal(snapshot.requiredOccupancyPct, 53);
  });
});
