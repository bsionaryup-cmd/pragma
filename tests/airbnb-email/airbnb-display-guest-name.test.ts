import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailEventKind } from "@prisma/client";
import {
  extractGuestNameFromReservationEmailEvent,
  isEmailEventEligibleForDisplayGuestName,
  pickGuestNameFromReservationEmailEvents,
} from "../../src/services/reservations/airbnb-display-guest-name.service";

describe("extractGuestNameFromReservationEmailEvent", () => {
  it("prefers enrichedFields and falls back to payload.signals", () => {
    const fromEnriched = extractGuestNameFromReservationEmailEvent({
      enrichedFields: { guestName: "Karla Durán" },
      payload: {
        signals: { guestName: "Yuly Correa" },
      },
    });
    assert.equal(fromEnriched, "Karla Durán");

    const fromPayload = extractGuestNameFromReservationEmailEvent({
      enrichedFields: {},
      payload: {
        signals: { guestName: "Yuly Correa" },
      },
    });
    assert.equal(fromPayload, "Yuly Correa");
  });
});

describe("isEmailEventEligibleForDisplayGuestName", () => {
  it("rejects CONFIRMED when confirmation codes conflict", () => {
    assert.equal(
      isEmailEventEligibleForDisplayGuestName({
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        eventConfirmationCode: "HMZMZBDTKN",
        reservationCode: "HMT2SW2RA9",
      }),
      false,
    );
  });

  it("accepts CONFIRMED when codes match", () => {
    assert.equal(
      isEmailEventEligibleForDisplayGuestName({
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        eventConfirmationCode: "HMT2SW2RA9",
        reservationCode: "HMT2SW2RA9",
      }),
      true,
    );
  });

  it("accepts CONFIRMED when reservation has no code yet", () => {
    assert.equal(
      isEmailEventEligibleForDisplayGuestName({
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        eventConfirmationCode: "HMCNCARK3K",
        reservationCode: null,
      }),
      true,
    );
  });

  it("does not filter non-CONFIRMED events by code", () => {
    assert.equal(
      isEmailEventEligibleForDisplayGuestName({
        eventKind: AirbnbEmailEventKind.UPDATED,
        eventConfirmationCode: "HMZMZBDTKN",
        reservationCode: "HMT2SW2RA9",
      }),
      true,
    );
  });
});

describe("pickGuestNameFromReservationEmailEvents", () => {
  it("prefers matching CONFIRMED over newer conflicting CONFIRMED (Alexander case)", () => {
    const name = pickGuestNameFromReservationEmailEvents({
      reservationCode: "HMT2SW2RA9",
      events: [
        {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: "HMZMZBDTKN",
          enrichedFields: { guestName: "Jairo Tapia" },
          createdAt: new Date("2026-06-15T14:36:16.763Z"),
        },
        {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: "HMT2SW2RA9",
          enrichedFields: { guestName: "Alexander Roblero" },
          createdAt: new Date("2026-06-15T05:07:16.868Z"),
        },
      ],
    });
    assert.equal(name, "Alexander Roblero");
  });

  it("skips conflicting CONFIRMED and uses matching CONFIRMED (Karla case)", () => {
    const name = pickGuestNameFromReservationEmailEvents({
      reservationCode: "HM4SPXSTS2",
      events: [
        {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: "HMCNCARK3K",
          enrichedFields: { guestName: "Yuly Escarley Correa cordero" },
          createdAt: new Date("2026-06-15T23:38:46.572Z"),
        },
        {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: "HM4SPXSTS2",
          enrichedFields: { guestName: "Karla Durán" },
          createdAt: new Date("2026-06-15T03:58:19.047Z"),
        },
      ],
    });
    assert.equal(name, "Karla Durán");
  });

  it("falls back to UPDATED when no eligible CONFIRMED exists (Jairo case)", () => {
    const name = pickGuestNameFromReservationEmailEvents({
      reservationCode: "HMZMZBDTKN",
      events: [
        {
          eventKind: AirbnbEmailEventKind.UPDATED,
          confirmationCode: "HMZMZBDTKN",
          enrichedFields: { guestName: "Jairo Tapia" },
          createdAt: new Date("2026-06-15T12:00:00.000Z"),
        },
      ],
    });
    assert.equal(name, "Jairo Tapia");
  });
});
