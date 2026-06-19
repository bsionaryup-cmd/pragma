import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailEventKind } from "@prisma/client";
import { shouldCorrectStoredReservationAmount } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";

describe("shouldCorrectStoredReservationAmount", () => {
  it("corrects Karla-style partial CONFIRMED amount when UPDATED has host payout", () => {
    assert.equal(
      shouldCorrectStoredReservationAmount({
        eventKind: AirbnbEmailEventKind.UPDATED,
        storedAmount: 247421,
        incomingAmount: 1023779.89,
        signals: { hostPayoutAmount: 1023779.89 },
      }),
      true,
    );
  });

  it("does not overwrite when stored amount already matches", () => {
    assert.equal(
      shouldCorrectStoredReservationAmount({
        eventKind: AirbnbEmailEventKind.UPDATED,
        storedAmount: 1023779.89,
        incomingAmount: 1023779.89,
        signals: { hostPayoutAmount: 1023779.89 },
      }),
      false,
    );
  });

  it("ignores CONFIRMED when stored already matches host payout", () => {
    assert.equal(
      shouldCorrectStoredReservationAmount({
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        storedAmount: 366508.17,
        incomingAmount: 366508.17,
        signals: { hostPayoutAmount: 366508.17, grossAmount: 449400 },
      }),
      false,
    );
  });

  it("corrects CONFIRMED gross amount when host payout is known", () => {
    assert.equal(
      shouldCorrectStoredReservationAmount({
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        storedAmount: 449400,
        incomingAmount: 449400,
        signals: { hostPayoutAmount: 366508.17, grossAmount: 449400 },
      }),
      true,
    );
  });
});