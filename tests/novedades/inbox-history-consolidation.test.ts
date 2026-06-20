import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inboxGuestNamesMatch,
  inquiryDateRangeOverlapsReservation,
  planInboxHistoryConsolidation,
  resolveInquiryPropertyIdFromHints,
} from "@/services/novedades/inbox-history-consolidation";

describe("inbox history consolidation", () => {
  it("absorbs inquiry into reservation by guest name and dates", () => {
    const plan = planInboxHistoryConsolidation({
      inquiries: [
        {
          pendingActivityId: "inq-1",
          propertyId: null,
          propertyHint: "Loft moderno 4P | Laureles | A 10 min de Comuna 13",
          createdAt: "2026-06-10T10:00:00.000Z",
          guestName: "Consulta Airbnb",
          dateRangeLabel: "25–30 jun 2026",
          subject: "Consulta sobre Loft moderno 4P | Laureles | A 10 min de Comuna 13 para el periodo 25–30 jun 2026",
          narrative: "Hola, queremos reservar",
          content: "Hola, queremos reservar",
        },
      ],
      reservations: [
        {
          reservationId: "res-1",
          propertyId: "prop-801",
          guestName: "Chanelva Alidikromo",
          checkIn: "2026-06-25",
          checkOut: "2026-06-30",
          createdAt: "2026-06-12T10:00:00.000Z",
        },
      ],
      properties: [
        {
          propertyId: "prop-801",
          name: "Loft moderno para 4 personas | Laureles | A 10 min de la Comuna 13",
          unitNumber: "801",
        },
      ],
    });

    assert.equal(plan.stats.absorbedCount, 1);
    assert.equal(plan.matches[0]?.reservationId, "res-1");
    assert.equal(plan.matches[0]?.resolvedGuestName, "Chanelva Alidikromo");
    assert.equal(plan.stats.consultaAirbnbAfterUnmatched, 0);
  });

  it("matches guest names with first-name tolerance", () => {
    assert.equal(inboxGuestNamesMatch("Karla Durán", "Karla"), true);
    assert.equal(inboxGuestNamesMatch("Consulta Airbnb", "Karla Durán"), false);
  });

  it("detects overlapping inquiry date ranges", () => {
    assert.equal(
      inquiryDateRangeOverlapsReservation({
        dateRangeLabel: "25–30 jun 2026",
        checkIn: "2026-06-25",
        checkOut: "2026-06-30",
      }),
      true,
    );
  });

  it("keeps unmatched inquiries separate", () => {
    const plan = planInboxHistoryConsolidation({
      inquiries: [
        {
          pendingActivityId: "inq-2",
          propertyId: "prop-999",
          propertyHint: null,
          createdAt: "2026-01-01T10:00:00.000Z",
          guestName: "Consulta Airbnb",
          dateRangeLabel: "1–5 ene 2026",
          subject: "Consulta",
          narrative: "Hola",
          content: "Hola",
        },
      ],
      reservations: [],
    });

    assert.equal(plan.stats.absorbedCount, 0);
    assert.equal(plan.unmatchedInquiryIds.length, 1);
    assert.equal(plan.stats.consultaAirbnbAfterUnmatched, 1);
  });

  it("resolves property id from inquiry subject when pending row lacks propertyId", () => {
    const propertyId = resolveInquiryPropertyIdFromHints({
      subject:
        "Consulta sobre Loft moderno 4P | Laureles | A 10 min de Comuna 13 para el periodo 25–30 jun 2026",
      propertyHint: null,
      properties: [
        {
          propertyId: "prop-801",
          name: "Loft moderno para 4 personas | Laureles | A 10 min de la Comuna 13",
          unitNumber: "801",
        },
      ],
    });

    assert.equal(propertyId, "prop-801");
  });

  it("detects jul day-only inquiry date ranges", () => {
    assert.equal(
      inquiryDateRangeOverlapsReservation({
        dateRangeLabel: "jul. 6 - 9",
        checkIn: "2026-07-06",
        checkOut: "2026-07-09",
      }),
      true,
    );
  });
});
