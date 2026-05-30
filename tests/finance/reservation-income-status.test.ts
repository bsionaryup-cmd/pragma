import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PaymentStatus } from "@prisma/client";
import { dateKeyToPrismaDate } from "@/lib/dates";
import {
  isReservationIncomeConfirmed,
  isReservationIncomePending,
} from "@/lib/finance/reservation-income-status";

const today = dateKeyToPrismaDate("2026-06-15");
const futureCheckIn = dateKeyToPrismaDate("2026-07-01");
const pastCheckIn = dateKeyToPrismaDate("2026-06-01");

describe("reservation income status", () => {
  it("marks future check-ins as pending even when paid", () => {
    assert.equal(
      isReservationIncomePending(futureCheckIn, PaymentStatus.PAID, today),
      true,
    );
    assert.equal(
      isReservationIncomeConfirmed(futureCheckIn, PaymentStatus.PAID, today),
      false,
    );
  });

  it("confirms income after check-in regardless of payment status", () => {
    assert.equal(
      isReservationIncomePending(pastCheckIn, PaymentStatus.PAID, today),
      false,
    );
    assert.equal(
      isReservationIncomeConfirmed(pastCheckIn, PaymentStatus.PAID, today),
      true,
    );
    assert.equal(
      isReservationIncomePending(pastCheckIn, PaymentStatus.PENDING, today),
      false,
    );
    assert.equal(
      isReservationIncomeConfirmed(pastCheckIn, PaymentStatus.PENDING, today),
      true,
    );
  });
});
