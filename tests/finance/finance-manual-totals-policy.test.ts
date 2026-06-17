import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partitionOtherIncomes } from "@/lib/finance/other-income-policy";

describe("finance manual totals policy", () => {
  it("excludes guest payment mirror rows from operational income totals", () => {
    const rows = [
      {
        id: "mirror",
        description: "Pago total · María · link:clabc123",
        amount: { toString: () => "500000" },
        incomeType: "Reserva",
        incomeDate: new Date("2026-05-10"),
      },
      {
        id: "manual",
        description: "Propina recepción",
        amount: { toString: () => "50000" },
        incomeType: "Propina",
        incomeDate: new Date("2026-05-12"),
      },
    ];

    const { operational } = partitionOtherIncomes(rows);
    const total = operational.reduce(
      (sum, row) => sum + Number(row.amount.toString()),
      0,
    );

    assert.equal(operational.length, 1);
    assert.equal(total, 50000);
  });
});
