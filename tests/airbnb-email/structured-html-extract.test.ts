import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmailBody,
  extractReservationSignals,
} from "../../src/modules/airbnb-email/parsing/extractors";
import {
  extractStructuredAirbnbFields,
  isDegradedForwardPlainText,
} from "../../src/modules/airbnb-email/parsing/structured-html-extract";

describe("structured HTML extraction", () => {
  const tableHtml = `
    <table>
      <tr><td>Check-in</td><td>2026-06-12</td></tr>
      <tr><td>Check-out</td><td>2026-06-15</td></tr>
      <tr><td>Alojamiento</td><td>Loft amplio 4P con Vista Panorámica | Laureles Top</td></tr>
      <tr><td>Código de confirmación</td><td>HM4SPXSTS2</td></tr>
    </table>
  `;

  it("extrae listing y fechas desde tabla HTML", () => {
    const structured = extractStructuredAirbnbFields(tableHtml);
    assert.equal(structured.listingName, "Loft amplio 4P con Vista Panorámica");
    assert.equal(structured.checkIn, "2026-06-12");
    assert.equal(structured.checkOut, "2026-06-15");
    assert.equal(structured.confirmationCode, "HM4SPXSTS2");
    assert.ok(structured.sources.length > 0);
  });

  it("rechaza basura tipo safety-info en valores", () => {
    const html = `
      <tr><td>Listing</td><td>s/1659842170040094387/details/safety-info></td></tr>
      <tr><td>Check-in</td><td>2026-07-01</td></tr>
    `;
    const structured = extractStructuredAirbnbFields(html);
    assert.equal(structured.listingName, null);
    assert.equal(structured.checkIn, "2026-07-01");
  });

  it("detecta forward degradado y usa HTML en buildEmailBody", () => {
    const degraded =
      "---------- Forwarded message ---------\nFrom: Airbnb\nSubject: Reserva";
    const html = tableHtml;
    assert.equal(isDegradedForwardPlainText(degraded), true);
    const body = buildEmailBody({
      subject: "Fwd: Reserva confirmada: Karla Durán",
      text: degraded,
      html,
    });
    assert.match(body, /2026-06-12/);
    assert.match(body, /Loft amplio/);
  });

  it("prioriza structured HTML sobre texto plano degradado", () => {
    const signals = extractReservationSignals({
      subject: "Fwd: Reserva confirmada: Karla Durán",
      body: "---------- Forwarded message ---------",
      html: tableHtml,
    });
    assert.equal(signals.listingName, "Loft amplio 4P con Vista Panorámica");
    assert.equal(signals.checkIn, "2026-06-12");
    assert.equal(signals.checkOut, "2026-06-15");
    assert.equal(signals.confirmationCode, "HM4SPXSTS2");
  });
});
