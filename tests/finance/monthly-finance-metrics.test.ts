import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PaymentStatus, PropertyStatus, ReservationStatus } from "@prisma/client";
import { dateKeyToPrismaDate } from "@/lib/dates";
import {
  aggregateMonthlyFinanceMetrics,
  computeMonthlyFinancePropertyMetric,
} from "@/lib/finance/monthly-finance-calc";
import {
  incrementMonthKey,
  listMonthKeysForStay,
  listMonthKeysForYear,
  unionMonthKeys,
} from "@/lib/finance/monthly-finance-month-keys";

describe("monthly-finance-month-keys", () => {
  it("lista meses cruzados por check-out", () => {
    assert.deepEqual(
      listMonthKeysForStay("2026-05-28", "2026-06-03"),
      ["2026-05", "2026-06"],
    );
  });

  it("incrementa meses calendario", () => {
    assert.equal(incrementMonthKey("2026-12"), "2027-01");
    assert.equal(incrementMonthKey("2026-05"), "2026-06");
  });

  it("genera los 12 meses del año", () => {
    assert.equal(listMonthKeysForYear(2026).length, 12);
    assert.equal(listMonthKeysForYear(2026)[0], "2026-01");
  });

  it("une claves sin duplicados", () => {
    assert.deepEqual(
      unionMonthKeys(["2026-05"], ["2026-05", "2026-06"]),
      ["2026-05", "2026-06"],
    );
  });
});

describe("monthly-finance-calc", () => {
  const activeProperty = { id: "p1", status: PropertyStatus.ACTIVE };
  const maintenanceProperty = { id: "p2", status: PropertyStatus.MAINTENANCE };

  it("descuenta bloqueos del inventario disponible", () => {
    const metric = computeMonthlyFinancePropertyMetric(
      activeProperty,
      "2026-05",
      [
        {
          id: "blocked",
          propertyId: "p1",
          status: ReservationStatus.BLOCKED,
          checkIn: dateKeyToPrismaDate("2026-05-10"),
          checkOut: dateKeyToPrismaDate("2026-05-13"),
          totalAmount: 0,
          paymentStatus: PaymentStatus.PENDING,
        },
        {
          id: "stay",
          propertyId: "p1",
          status: ReservationStatus.CONFIRMED,
          checkIn: dateKeyToPrismaDate("2026-05-20"),
          checkOut: dateKeyToPrismaDate("2026-05-23"),
          totalAmount: 300000,
          paymentStatus: PaymentStatus.PAID,
        },
      ],
      new Map(),
      dateKeyToPrismaDate("2026-05-31"),
    );

    assert.equal(metric.availableNights, 31 - 3);
    assert.equal(metric.occupiedNights, 3);
    assert.equal(metric.occupancyPct, Math.round((3 / 28) * 100));
  });

  it("excluye propiedades en mantenimiento", () => {
    const metric = computeMonthlyFinancePropertyMetric(
      maintenanceProperty,
      "2026-05",
      [],
      new Map(),
      dateKeyToPrismaDate("2026-05-31"),
    );

    assert.equal(metric.availableNights, 0);
    assert.equal(metric.occupiedNights, 0);
    assert.equal(metric.occupancyPct, 0);
  });

  it("agrega métricas por organización", () => {
    const aggregate = aggregateMonthlyFinanceMetrics([
      {
        propertyId: "p1",
        availableNights: 20,
        occupiedNights: 10,
        occupancyPct: 50,
        grossRevenue: 100,
        projectedRevenue: 120,
      },
      {
        propertyId: "p2",
        availableNights: 10,
        occupiedNights: 5,
        occupancyPct: 50,
        grossRevenue: 50,
        projectedRevenue: 60,
      },
    ]);

    assert.equal(aggregate.availableNights, 30);
    assert.equal(aggregate.occupiedNights, 15);
    assert.equal(aggregate.occupancyPct, 50);
    assert.equal(aggregate.grossRevenue, 150);
    assert.equal(aggregate.projectedRevenue, 180);
  });
});
