import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailEventKind } from "@prisma/client";
import { classifyAirbnbEmail } from "../../src/modules/airbnb-email/router/airbnb-email-router";
import {
  extractReservationSignals,
  hashEmailContent,
} from "../../src/modules/airbnb-email/parsing/extractors";
import {
  extractEmailAddress,
  isLikelyAirbnbSender,
  shouldProcessAirbnbEmail,
} from "../../src/modules/airbnb-email/lib/sender-guard";
import { applyMatchPolicy } from "../../src/modules/airbnb-email/lib/match-policy";
import { AirbnbEmailMatchMethod } from "@prisma/client";
import {
  FIXTURE_CANCELED,
  FIXTURE_CHECKIN_REMINDER,
  FIXTURE_CONFIRMED_ES,
  FIXTURE_EXTENDED,
  FIXTURE_GUEST_REVIEW_SUBMITTED,
  FIXTURE_HOST_REVIEW_REQUESTED,
  FIXTURE_MESSAGE_EN,
  FIXTURE_PAYOUT_ES,
  FIXTURE_REVIEW_PUBLISHED,
  FIXTURE_TEXT_ONLY,
  FIXTURE_UNKNOWN_SPAM,
  FIXTURE_UPDATED,
} from "./fixtures/templates";

function classifyFixture(input: {
  from: string;
  subject: string;
  body?: string;
  html?: string;
  text?: string;
}) {
  const body =
    input.body ??
    input.text ??
    (input.html ? input.html.replace(/<[^>]+>/g, " ") : "");
  return classifyAirbnbEmail({ from: input.from, subject: input.subject, body });
}

describe("isLikelyAirbnbSender", () => {
  it("acepta automated y express", () => {
    assert.equal(isLikelyAirbnbSender("automated@airbnb.com"), true);
    assert.equal(isLikelyAirbnbSender("Airbnb <express@airbnb.com>"), true);
  });

  it("rechaza remitentes no Airbnb", () => {
    assert.equal(isLikelyAirbnbSender("newsletter@marketing.com"), false);
  });

  it("acepta forward Gmail si el contenido es Airbnb", () => {
    assert.equal(
      shouldProcessAirbnbEmail({
        from: "owner@gmail.com",
        subject: "Fwd: Reserva confirmada",
        body: "Código de confirmación HM8K2P9Q4X check-in airbnb",
      }),
      true,
    );
  });
});

describe("classification matrix", () => {
  const cases: Array<{
    name: string;
    fixture: { from: string; subject: string; body?: string; html?: string; text?: string };
    expected: AirbnbEmailEventKind;
  }> = [
    { name: "CONFIRMED", fixture: FIXTURE_CONFIRMED_ES, expected: AirbnbEmailEventKind.CONFIRMED },
    { name: "CHECKIN_REMINDER", fixture: FIXTURE_CHECKIN_REMINDER, expected: AirbnbEmailEventKind.CHECKIN_REMINDER },
    { name: "PAYOUT", fixture: FIXTURE_PAYOUT_ES, expected: AirbnbEmailEventKind.PAYOUT_PROCESSED },
    { name: "MESSAGE", fixture: FIXTURE_MESSAGE_EN, expected: AirbnbEmailEventKind.RESERVATION_MESSAGE },
    { name: "HOST_REVIEW", fixture: FIXTURE_HOST_REVIEW_REQUESTED, expected: AirbnbEmailEventKind.HOST_REVIEW_REQUESTED },
    { name: "GUEST_REVIEW", fixture: FIXTURE_GUEST_REVIEW_SUBMITTED, expected: AirbnbEmailEventKind.GUEST_REVIEW_SUBMITTED },
    { name: "REVIEW_PUBLISHED", fixture: FIXTURE_REVIEW_PUBLISHED, expected: AirbnbEmailEventKind.GUEST_REVIEW_PUBLISHED },
    { name: "CANCELED", fixture: FIXTURE_CANCELED, expected: AirbnbEmailEventKind.CANCELED },
    { name: "UPDATED", fixture: FIXTURE_UPDATED, expected: AirbnbEmailEventKind.UPDATED },
    { name: "EXTENDED", fixture: FIXTURE_EXTENDED, expected: AirbnbEmailEventKind.EXTENDED },
  ];

  for (const { name, fixture, expected } of cases) {
    it(`clasifica ${name}`, () => {
      const result = classifyFixture(fixture);
      assert.equal(result.eventKind, expected);
    });
  }

  it("UNKNOWN para spam", () => {
    const result = classifyFixture(FIXTURE_UNKNOWN_SPAM);
    assert.equal(result.eventKind, AirbnbEmailEventKind.UNKNOWN);
  });
});

describe("extractReservationSignals edge cases", () => {
  it("text-only sin HTML", () => {
    const signals = extractReservationSignals({
      subject: FIXTURE_TEXT_ONLY.subject,
      body: FIXTURE_TEXT_ONLY.text ?? "",
      html: null,
    });
    assert.equal(signals.confirmationCode, "HM7TEXT01");
  });

  it("idempotencia hash estable con mismo messageId", () => {
    const a = hashEmailContent({
      messageId: "msg-abc",
      from: "automated@airbnb.com",
      subject: "Test",
      body: "body",
      organizationId: "org_1",
    });
    const b = hashEmailContent({
      messageId: "msg-abc",
      from: "automated@airbnb.com",
      subject: "Test",
      body: "body",
      organizationId: "org_1",
    });
    assert.equal(a, b);
  });

  it("hash distinto por tenant", () => {
    const a = hashEmailContent({
      messageId: "msg-abc",
      from: "automated@airbnb.com",
      subject: "Test",
      body: "body",
      organizationId: "org_a",
    });
    const b = hashEmailContent({
      messageId: "msg-abc",
      from: "automated@airbnb.com",
      subject: "Test",
      body: "body",
      organizationId: "org_b",
    });
    assert.notEqual(a, b);
  });

  it("normaliza Fwd: para idempotencia", () => {
    const a = hashEmailContent({
      from: "automated@airbnb.com",
      subject: "Reserva confirmada",
      body: "HM123456",
      organizationId: "org_1",
    });
    const b = hashEmailContent({
      from: "automated@airbnb.com",
      subject: "Fwd: Reserva confirmada",
      body: "HM123456",
      organizationId: "org_1",
    });
    assert.equal(a, b);
  });
});

describe("enrichment policy", () => {
  it("no enrich medium tier", () => {
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
    assert.equal(match.allowReservationEnrichment, false);
  });
});

describe("extractEmailAddress", () => {
  it("parsea display name", () => {
    assert.equal(
      extractEmailAddress("Airbnb <automated@airbnb.com>"),
      "automated@airbnb.com",
    );
  });
});
