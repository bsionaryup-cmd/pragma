import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailMatchMethod } from "@prisma/client";
import { applyMatchPolicy } from "../../src/modules/airbnb-email/lib/match-policy";
import { extractReservationSignals } from "../../src/modules/airbnb-email/parsing/extractors";
import {
  isPlaceholderGuestName,
  isZeroReservationAmount,
  normalizeIcalGuestNameFromSummary,
  splitGuestName,
} from "../../src/modules/airbnb-email/domains/safe-reservation-enrichment";
import { FIXTURE_CONFIRMED_ES } from "./fixtures/templates";

describe("safe reservation enrichment helpers", () => {
  it("detecta nombre placeholder de iCal", () => {
    assert.equal(isPlaceholderGuestName("Huésped Airbnb"), true);
    assert.equal(isPlaceholderGuestName("Airbnb"), true);
    assert.equal(isPlaceholderGuestName("Airbnb te envió un mensaje"), true);
    assert.equal(isPlaceholderGuestName("Ana García"), false);
  });

  it("normaliza SUMMARY iCal sin nombre real", () => {
    assert.equal(normalizeIcalGuestNameFromSummary("Airbnb", false), "Huésped Airbnb");
    assert.equal(normalizeIcalGuestNameFromSummary("Reserved", false), "Huésped Airbnb");
    assert.equal(
      normalizeIcalGuestNameFromSummary("Reserved - Milena Barrero", false),
      "Milena Barrero",
    );
  });

  it("detecta totalAmount en cero", () => {
    assert.equal(isZeroReservationAmount(0), true);
    assert.equal(isZeroReservationAmount("0.00"), true);
    assert.equal(isZeroReservationAmount(1200), false);
  });

  it("divide nombre de huésped", () => {
    const split = splitGuestName("Ana García López");
    assert.equal(split.guestName, "Ana García López");
    assert.equal(split.guestFirstName, "Ana");
    assert.equal(split.guestLastName, "García López");
  });
});

describe("enrichment policy (pilot)", () => {
  it("permite enrich en LISTING_DATES 0.82 con código HM", () => {
    const match = applyMatchPolicy(
      {
        reservationId: "r1",
        propertyId: "p1",
        organizationId: "o1",
        method: AirbnbEmailMatchMethod.LISTING_DATES,
        confidence: 0.82,
      },
      { hasConfirmationCodeInEmail: true },
    );
    assert.equal(match.allowReservationEnrichment, true);
  });

  it("no enrich sin código en email", () => {
    const match = applyMatchPolicy(
      {
        reservationId: "r1",
        propertyId: "p1",
        organizationId: "o1",
        method: AirbnbEmailMatchMethod.LISTING_DATES,
        confidence: 0.82,
      },
      { hasConfirmationCodeInEmail: false },
    );
    assert.equal(match.allowReservationEnrichment, false);
  });
});

describe("extractReservationSignals guest fields", () => {
  it("extrae email y teléfono cuando están en plantilla", () => {
    const body = `
      ${FIXTURE_CONFIRMED_ES.html}
      Email: maria.guest@example.com
      Teléfono: +57 300 123 4567
      2 huéspedes
    `;
    const signals = extractReservationSignals({
      subject: FIXTURE_CONFIRMED_ES.subject,
      body: `Reserva confirmada\n${body.replace(/<[^>]+>/g, " ")}`,
      html: FIXTURE_CONFIRMED_ES.html,
    });
    assert.equal(signals.confirmationCode, "HM8K2P9Q4X");
    assert.equal(signals.guestName, "Ana García");
    assert.equal(signals.guestEmail, "maria.guest@example.com");
    assert.ok(signals.guestPhone?.includes("300"));
    assert.equal(signals.guestCount, 2);
  });
});
