import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateKeyToPrismaDate } from "@/lib/dates";
import {
  checkInFallsInMonth,
  financeMonthBounds,
  reservationNightsInMonth,
  reservationOverlapsMonth,
} from "@/lib/finance/finance-month-attribution";

describe("finance-month-attribution", () => {
  const may2025 = financeMonthBounds(2025, 4);

  it("detecta solapamiento con check-in el primer día del mes", () => {
    const checkIn = dateKeyToPrismaDate("2025-05-01");
    const checkOut = dateKeyToPrismaDate("2025-05-05");
    assert.equal(
      reservationOverlapsMonth(checkIn, checkOut, may2025.start, may2025.end),
      true,
    );
    assert.equal(checkInFallsInMonth(checkIn, may2025.start, may2025.end), true);
  });

  it("incluye estadías iniciadas antes del mes que continúan en mayo", () => {
    const checkIn = dateKeyToPrismaDate("2025-04-28");
    const checkOut = dateKeyToPrismaDate("2025-05-05");
    assert.equal(
      reservationOverlapsMonth(checkIn, checkOut, may2025.start, may2025.end),
      true,
    );
    assert.equal(checkInFallsInMonth(checkIn, may2025.start, may2025.end), false);
  });

  it("cuenta noches reservadas dentro del mes", () => {
    const checkIn = dateKeyToPrismaDate("2025-04-28");
    const checkOut = dateKeyToPrismaDate("2025-05-05");
    assert.equal(
      reservationNightsInMonth(checkIn, checkOut, may2025.start, may2025.end),
      4,
    );
  });

  it("no atribuye ingresos de mayo a abril", () => {
    const april2025 = financeMonthBounds(2025, 3);
    const checkIn = dateKeyToPrismaDate("2025-05-02");
    const checkOut = dateKeyToPrismaDate("2025-05-06");
    assert.equal(
      checkInFallsInMonth(checkIn, april2025.start, april2025.end),
      false,
    );
    assert.equal(
      checkInFallsInMonth(checkIn, may2025.start, may2025.end),
      true,
    );
  });
});
