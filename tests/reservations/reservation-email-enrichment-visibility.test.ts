import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reservationHasVisibleEmailEnrichment,
  type ReservationEmailEnrichmentVisibilityInput,
} from "../../src/lib/airbnb-email/reservation-enrichment-visibility";

function emptyDetail(): ReservationEmailEnrichmentVisibilityInput {
  return {
    emailEnriched: false,
    emailEventCount: 0,
    linkedAuditCount: 0,
    lastEventKind: null,
    lastMatchConfidence: null,
    payoutCount: 0,
    communicationCount: 0,
    reviewCount: 0,
    pendingTaskCount: 0,
    manualReviewPending: false,
    lastProcessedAt: null,
  };
}

describe("reservationHasVisibleEmailEnrichment", () => {
  it("oculta cuando no hay actividad email", () => {
    assert.equal(reservationHasVisibleEmailEnrichment(emptyDetail()), false);
  });

  it("muestra con evento vinculado aunque no haya enrichedFields", () => {
    const detail = {
      ...emptyDetail(),
      emailEventCount: 1,
      lastEventKind: "CONFIRMED",
      lastMatchConfidence: 0.98,
    };
    assert.equal(reservationHasVisibleEmailEnrichment(detail), true);
  });

  it("muestra con audit vinculado en revisión manual", () => {
    const detail = {
      ...emptyDetail(),
      linkedAuditCount: 1,
      manualReviewPending: true,
      lastProcessedAt: new Date().toISOString(),
    };
    assert.equal(reservationHasVisibleEmailEnrichment(detail), true);
  });
});
