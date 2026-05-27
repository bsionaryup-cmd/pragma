import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailMatchMethod } from "@prisma/client";
import { applyMatchPolicy } from "../../src/modules/airbnb-email/lib/match-policy";
import {
  guestNameMatches,
  narrowContextualCandidates,
  scoreContextualCandidate,
} from "../../src/modules/airbnb-email/matching/contextual-reservation-matcher";

describe("contextual match scoring", () => {
  const candidate = {
    id: "res_1",
    propertyId: "prop_1",
    guestName: "María López",
    checkIn: new Date("2026-06-01T12:00:00.000Z"),
    checkOut: new Date("2026-06-05T12:00:00.000Z"),
    icalUid: "ical-1",
    organizationId: "org_1",
  };

  it("requiere HM + listing + señales para score alto", () => {
    const score = scoreContextualCandidate({
      candidate,
      hasConfirmationCode: true,
      guestName: "María",
      parsedCheckIn: null,
      parsedCheckOut: null,
    });
    assert.ok(score >= 0.9);
  });

  it("puede puntuar sin HM usando contexto iCal", () => {
    const score = scoreContextualCandidate({
      candidate,
      hasConfirmationCode: false,
      guestName: "María",
      parsedCheckIn: null,
      parsedCheckOut: null,
    });
    assert.ok(score >= 0.78);
  });

  it("guestNameMatches parcial", () => {
    assert.equal(guestNameMatches("María García", "María López"), true);
    assert.equal(guestNameMatches("Pedro", "María López"), false);
  });

  it("narrow a un candidato único sin fechas parsed", () => {
    const selected = narrowContextualCandidates(
      [candidate],
      { guestName: "María", confirmationCode: "HM4SPXSTS2" },
      null,
      null,
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.id, "res_1");
  });

  it("rechaza múltiples candidatos sin desambiguar", () => {
    const other = {
      ...candidate,
      id: "res_2",
      guestName: "Carlos Ruiz",
    };
    const selected = narrowContextualCandidates(
      [candidate, other],
      { guestName: null, confirmationCode: "HM4SPXSTS2" },
      null,
      null,
    );
    assert.equal(selected.length, 0);
  });

  it("desambigua por guestName con múltiples candidatos", () => {
    const other = {
      ...candidate,
      id: "res_2",
      guestName: "Carlos Ruiz",
    };
    const selected = narrowContextualCandidates(
      [candidate, other],
      { guestName: "María", confirmationCode: "HM4SPXSTS2" },
      null,
      null,
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.id, "res_1");
  });
});

describe("contextual match policy", () => {
  it("permite enrich en high LISTING_CONTEXTUAL_MATCH con HM", () => {
    const match = applyMatchPolicy(
      {
        reservationId: "res_1",
        propertyId: "prop_1",
        organizationId: "org_1",
        method: AirbnbEmailMatchMethod.LISTING_CONTEXTUAL_MATCH,
        confidence: 0.9,
      },
      { hasConfirmationCodeInEmail: true },
    );
    assert.equal(match.tier, "high");
    assert.equal(match.allowReservationEnrichment, true);
    assert.equal(match.requiresManualReview, false);
  });

  it("permite enrich en medium contextual 0.84+ con HM", () => {
    const match = applyMatchPolicy(
      {
        reservationId: "res_1",
        propertyId: "prop_1",
        organizationId: "org_1",
        method: AirbnbEmailMatchMethod.LISTING_CONTEXTUAL_MATCH,
        confidence: 0.84,
      },
      { hasConfirmationCodeInEmail: true },
    );
    assert.equal(match.tier, "medium");
    assert.equal(match.allowReservationEnrichment, true);
    assert.equal(match.requiresManualReview, true);
  });

  it("no enrich contextual sin HM en email", () => {
    const match = applyMatchPolicy(
      {
        reservationId: "res_1",
        propertyId: "prop_1",
        organizationId: "org_1",
        method: AirbnbEmailMatchMethod.LISTING_CONTEXTUAL_MATCH,
        confidence: 0.9,
      },
      { hasConfirmationCodeInEmail: false },
    );
    assert.equal(match.allowReservationEnrichment, false);
  });

  it("permite enrich en ICAL_CONTEXTUAL_MATCH high conservador", () => {
    const match = applyMatchPolicy(
      {
        reservationId: "res_1",
        propertyId: "prop_1",
        organizationId: "org_1",
        method: AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH,
        confidence: 0.91,
      },
      { hasConfirmationCodeInEmail: false },
    );
    assert.equal(match.allowReservationEnrichment, true);
    assert.equal(match.requiresManualReview, false);
  });
});
