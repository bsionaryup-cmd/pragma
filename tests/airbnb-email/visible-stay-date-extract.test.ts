import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractReservationSignals } from "../../src/modules/airbnb-email/parsing/extractors";
import { extractStructuredAirbnbFields } from "../../src/modules/airbnb-email/parsing/structured-html-extract";
import {
  extractVisibleStayDates,
  looksLikeVisibleStayDateLine,
  normalizeVisibleStayDate,
} from "../../src/modules/airbnb-email/parsing/visible-stay-date-extract";

describe("visible stay date extract", () => {
  it("parsea vie, 19 jun y mar, 23 jun a ISO", () => {
    assert.equal(normalizeVisibleStayDate("vie, 19 jun"), "2026-06-19");
    assert.equal(normalizeVisibleStayDate("mar, 23 jun"), "2026-06-23");
    assert.equal(normalizeVisibleStayDate("19 jun"), "2026-06-19");
    assert.equal(normalizeVisibleStayDate("23 de junio de 2026"), "2026-06-23");
  });

  it("detecta líneas de fecha sin pasar por listing heuristics", () => {
    assert.equal(looksLikeVisibleStayDateLine("vie, 19 jun"), true);
    assert.equal(looksLikeVisibleStayDateLine("Loft amplio 4P con Vista"), false);
  });

  it("extrae check-in y check-out desde HTML Airbnb visible", () => {
    const html = `
      <table>
        <tr><td>Check-in</td><td>vie, 19 jun</td></tr>
        <tr><td>Check-out</td><td>mar, 23 jun</td></tr>
        <tr><td>Alojamiento</td><td>Loft amplio 4P con Vista Panorámica | Laureles Top</td></tr>
      </table>
    `;
    const dates = extractVisibleStayDates(html, { referenceYear: 2026 });
    assert.equal(dates.checkIn, "2026-06-19");
    assert.equal(dates.checkOut, "2026-06-23");
  });

  it("structured extract usa fechas visibles sin listing scoring", () => {
    const structured = extractStructuredAirbnbFields(`
      <p>vie, 19 jun</p>
      <p>mar, 23 jun</p>
      <img alt="Loft amplio 4P con Vista Panorámica | Laureles Top" />
    `);
    assert.equal(structured.checkIn, "2026-06-19");
    assert.equal(structured.checkOut, "2026-06-23");
  });

  it("extractReservationSignals expone fechas para PROPERTY_RESERVATION_MATCH", () => {
    const signals = extractReservationSignals({
      subject: "Fwd: Reserva confirmada: Karla Durán llega el vie, 19 jun.",
      body: "Código HM4SPXSTS2",
      html: `
        <table>
          <tr><td>Check-in</td><td>vie, 19 jun</td></tr>
          <tr><td>Check-out</td><td>mar, 23 jun</td></tr>
        </table>
      `,
    });
    assert.match(signals.checkIn ?? "", /^2026-06-19$/);
    assert.match(signals.checkOut ?? "", /^2026-06-23$/);
  });
});
