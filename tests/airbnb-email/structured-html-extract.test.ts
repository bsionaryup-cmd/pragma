import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmailBody,
  extractReservationSignals,
} from "../../src/modules/airbnb-email/parsing/extractors";
import {
  isPlausibleVisibleListingName,
  normalizeVisibleListingName,
} from "../../src/modules/airbnb-email/parsing/listing-name-extract";
import {
  extractStructuredAirbnbFields,
  isDegradedForwardPlainText,
  sanitizeHtmlForVisibleListingExtract,
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

  it("extrae listing visible completo desde tabla HTML", () => {
    const structured = extractStructuredAirbnbFields(tableHtml);
    assert.equal(
      structured.listingName,
      "Loft amplio 4P con Vista Panorámica | Laureles Top",
    );
    assert.equal(structured.checkIn, "2026-06-12");
    assert.equal(structured.checkOut, "2026-06-15");
    assert.equal(structured.confirmationCode, "HM4SPXSTS2");
    assert.ok(structured.sources.length > 0);
  });

  it("rechaza basura tipo safety-info y no usa href como listing", () => {
    const html = `
      <a href="https://www.airbnb.com/rooms/1659842170040094387/details/safety-info">
        s/1659842170040094387/details/safety-info>
      </a>
      <tr><td>Check-in</td><td>2026-07-01</td></tr>
      <p>Loft amplio 4P con Vista Panorámica | Laureles Top</p>
    `;
    const sanitized = sanitizeHtmlForVisibleListingExtract(html);
    assert.doesNotMatch(sanitized, /safety-info/);
    const structured = extractStructuredAirbnbFields(html);
    assert.equal(structured.listingName, "Loft amplio 4P con Vista Panorámica | Laureles Top");
    assert.equal(
      isPlausibleVisibleListingName("s/1659842170040094387/details/safety-info>"),
      false,
    );
  });

  it("prefiere tabla Alojamiento sobre anchor basura en forward real", () => {
    const html = `
      <table>
        <tr><td>Alojamiento</td><td>Loft amplio 4P con Vista Panorámica | Laureles Top</td></tr>
      </table>
      <a href="https://www.airbnb.com/rooms/1659842170040094387/details/safety-info">ver detalles</a>
    `;
    const structured = extractStructuredAirbnbFields(html);
    assert.equal(
      structured.listingName,
      "Loft amplio 4P con Vista Panorámica | Laureles Top",
    );
  });

  it("extrae listing desde sección Dónde te hospedarás", () => {
    const html = `
      <div>Dónde te hospedarás</div>
      <div><strong>Loft amplio 4P con Vista Panorámica | Laureles Top</strong></div>
    `;
    const structured = extractStructuredAirbnbFields(html);
    assert.equal(
      structured.listingName,
      "Loft amplio 4P con Vista Panorámica | Laureles Top",
    );
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
    assert.equal(
      signals.listingName,
      "Loft amplio 4P con Vista Panorámica | Laureles Top",
    );
    assert.equal(signals.checkIn, "2026-06-12");
    assert.equal(signals.checkOut, "2026-06-15");
    assert.equal(signals.confirmationCode, "HM4SPXSTS2");
  });

  it("rechaza property: path en texto plano", () => {
    const garbage = normalizeVisibleListingName(
      "property s/1659842170040094387/details/safety-info>",
    );
    assert.equal(garbage, null);
  });
});
