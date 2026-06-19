import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AirbnbEmailEventKind,
  ReservationStatus,
} from "@prisma/client";
import {
  isFinanceRevenueEmailEvent,
  isReservationFinanceTraceable,
  pickFinanceRevenueEmailEvents,
} from "@/lib/finance/reservation-finance-trace";
import { buildReservationRevenueSourcesMapFromEmailEvents } from "@/lib/finance/reservation-revenue-amount";

describe("reservation finance trace", () => {
  it("ignores canceled email events for active reservations", () => {
    const reservationId = "res-1";
    const statusById = new Map([[reservationId, ReservationStatus.CHECKED_IN]]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CANCELED,
        enrichedFields: { grossAmount: 449400 },
        payload: { signals: { grossAmount: 449400 } },
      },
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: { hostPayoutAmount: 366508 },
        payload: { signals: { hostPayoutAmount: 366508 } },
      },
    ];

    const picked = pickFinanceRevenueEmailEvents(rows, statusById);
    assert.equal(picked.get(reservationId)?.eventKind, AirbnbEmailEventKind.CONFIRMED);

    const sources = buildReservationRevenueSourcesMapFromEmailEvents(
      rows,
      statusById,
    );
    const merged = sources.get(reservationId)?.payloadSignals as Record<
      string,
      unknown
    >;
    assert.equal(merged.hostPayoutAmount, 366508);
    assert.equal(merged.grossAmount, undefined);
  });

  it("requires iCal uid and confirmation code when totalAmount is zero", () => {
    assert.equal(
      isReservationFinanceTraceable({
        platform: "AIRBNB",
        totalAmount: 0,
        icalUid: "abc",
        reservationCode: "HM123",
      }),
      true,
    );
    assert.equal(
      isReservationFinanceTraceable({
        platform: "AIRBNB",
        totalAmount: 0,
        icalUid: "abc",
        reservationCode: null,
      }),
      false,
    );
  });

  it("allows traceability from email revenue when iCal exists without confirmation code", () => {
    assert.equal(
      isReservationFinanceTraceable({
        platform: "AIRBNB",
        totalAmount: 0,
        icalUid: "abc",
        reservationCode: null,
        emailRevenueAmount: 366508.17,
      }),
      true,
    );
  });

  it("allows canceled email events only for canceled reservations", () => {
    assert.equal(
      isFinanceRevenueEmailEvent(
        AirbnbEmailEventKind.CANCELED,
        ReservationStatus.CANCELLED,
      ),
      true,
    );
    assert.equal(
      isFinanceRevenueEmailEvent(
        AirbnbEmailEventKind.CANCELED,
        ReservationStatus.CONFIRMED,
      ),
      false,
    );
  });

  it("prefers UPDATED event with host payout over stale CONFIRMED amount", () => {
    const reservationId = "karla-res";
    const statusById = new Map([[reservationId, ReservationStatus.CONFIRMED]]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: { hostPayoutAmount: 247421 },
        payload: { signals: { hostPayoutAmount: 247421 } },
      },
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.UPDATED,
        enrichedFields: { hostPayoutAmount: 1023779.89 },
        payload: { signals: { hostPayoutAmount: 1023779.89 } },
      },
    ];

    const picked = pickFinanceRevenueEmailEvents(rows, statusById);
    assert.equal(picked.get(reservationId)?.eventKind, AirbnbEmailEventKind.UPDATED);
    assert.equal(
      (picked.get(reservationId)?.enrichedFields as { hostPayoutAmount: number })
        .hostPayoutAmount,
      1023779.89,
    );
  });
});
