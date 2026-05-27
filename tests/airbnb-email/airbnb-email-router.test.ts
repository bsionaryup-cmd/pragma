import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailEventKind } from "@prisma/client";
import { classifyAirbnbEmail } from "../../src/modules/airbnb-email/router/airbnb-email-router";
import {
  extractReservationSignals,
  hashEmailContent,
} from "../../src/modules/airbnb-email/parsing/extractors";
import { detectSafeCommunicationIntent } from "../../src/modules/airbnb-email/domains/communication-intent";
import { applyMatchPolicy } from "../../src/modules/airbnb-email/lib/match-policy";
import { AirbnbEmailMatchMethod } from "@prisma/client";
import {
  FIXTURE_CONFIRMED_ES,
  FIXTURE_PAYOUT_ES,
} from "./fixtures/templates";

describe("classifyAirbnbEmail", () => {
  it("clasifica payout desde automated@airbnb.com", () => {
    const result = classifyAirbnbEmail({
      from: "automated@airbnb.com",
      subject: "Tu pago ha sido procesado",
      body: "El pago procesado está en camino",
    });
    assert.equal(result.eventKind, AirbnbEmailEventKind.PAYOUT_PROCESSED);
  });

  it("clasifica cancelación", () => {
    const result = classifyAirbnbEmail({
      from: "automated@airbnb.com",
      subject: "Reserva cancelada",
      body: "Tu reserva fue cancelada",
    });
    assert.equal(result.eventKind, AirbnbEmailEventKind.CANCELED);
  });

  it("clasifica mensaje desde express@airbnb.com", () => {
    const result = classifyAirbnbEmail({
      from: "express@airbnb.com",
      subject: "Nuevo mensaje sobre tu reserva",
      body: "Un huésped te envió un mensaje",
    });
    assert.equal(result.eventKind, AirbnbEmailEventKind.RESERVATION_MESSAGE);
  });
});

describe("extractReservationSignals", () => {
  it("extrae código HM y fechas ISO desde HTML", () => {
    const signals = extractReservationSignals({
      subject: "Reserva confirmada HM8K2P9Q4X",
      body: "",
      html: `
        <p>Código de confirmación: HM8K2P9Q4X</p>
        <p>Check-in: 2026-06-01</p>
        <p>Check-out: 2026-06-05</p>
        <p>Huésped: Ana García</p>
      `,
    });
    assert.equal(signals.confirmationCode, "HM8K2P9Q4X");
    assert.equal(signals.checkIn, "2026-06-01");
    assert.equal(signals.checkOut, "2026-06-05");
    assert.match(signals.guestName ?? "", /Ana/i);
  });

  it("extrae montos de payout etiquetados", () => {
    const signals = extractReservationSignals({
      subject: "Pago enviado",
      body: "Ingresos brutos: $1,200.00 Host service fee: $180.00 Total: $1,020.00",
      html: null,
    });
    assert.equal(signals.grossAmount, 1200);
    assert.equal(signals.hostFee, 180);
    assert.equal(signals.netPayout, 1020);
  });
});

describe("hashEmailContent", () => {
  it("es determinístico", () => {
    const input = {
      messageId: "msg-1",
      from: "automated@airbnb.com",
      subject: "Reserva confirmada",
      body: "Código HM123456",
    };
    assert.equal(hashEmailContent(input), hashEmailContent(input));
  });
});

describe("applyMatchPolicy", () => {
  it("permite enrich en medium LISTING_DATES con código HM en email", () => {
    const match = applyMatchPolicy(
      {
        reservationId: "res_1",
        propertyId: "prop_1",
        organizationId: null,
        method: AirbnbEmailMatchMethod.LISTING_DATES,
        confidence: 0.82,
      },
      { hasConfirmationCodeInEmail: true },
    );
    assert.equal(match.tier, "medium");
    assert.equal(match.allowReservationEnrichment, true);
  });

  it("permite enrich en high con confirmation code", () => {
    const match = applyMatchPolicy(
      {
        reservationId: "res_1",
        propertyId: "prop_1",
        organizationId: null,
        method: AirbnbEmailMatchMethod.CONFIRMATION_CODE,
        confidence: 0.98,
      },
      { hasConfirmationCodeInEmail: true },
    );
    assert.equal(match.tier, "high");
    assert.equal(match.allowReservationEnrichment, true);
  });
});

describe("detectSafeCommunicationIntent", () => {
  it("detecta early check-in", () => {
    assert.equal(
      detectSafeCommunicationIntent("¿Podemos hacer early check-in a las 11?"),
      "EARLY_CHECKIN",
    );
  });
});

describe("templates reales (sintéticos)", () => {
  it("clasifica y extrae confirmed ES", () => {
    const body = FIXTURE_CONFIRMED_ES.html.replace(/<[^>]+>/g, " ");
    const classified = classifyAirbnbEmail({
      from: FIXTURE_CONFIRMED_ES.from,
      subject: FIXTURE_CONFIRMED_ES.subject,
      body,
    });
    assert.equal(classified.eventKind, AirbnbEmailEventKind.CONFIRMED);
    const signals = extractReservationSignals({
      subject: FIXTURE_CONFIRMED_ES.subject,
      body,
      html: FIXTURE_CONFIRMED_ES.html,
    });
    assert.equal(signals.confirmationCode, "HM8K2P9Q4X");
  });

  it("clasifica payout", () => {
    const classified = classifyAirbnbEmail({
      from: FIXTURE_PAYOUT_ES.from,
      subject: FIXTURE_PAYOUT_ES.subject,
      body: FIXTURE_PAYOUT_ES.body,
    });
    assert.equal(classified.eventKind, AirbnbEmailEventKind.PAYOUT_PROCESSED);
  });
});
