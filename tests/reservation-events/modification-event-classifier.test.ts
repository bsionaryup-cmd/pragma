import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyModificationObservabilityEvent } from "../../src/modules/reservation-events/classifiers/modification-event-classifier";
import {
  buildModificationEventDescription,
  extractModificationEventMetadata,
} from "../../src/modules/reservation-events/parsing/modification-metadata-extract";

describe("modification observability classifier", () => {
  it("detects MODIFICATION_REQUEST from guest change subject", () => {
    const result = classifyModificationObservabilityEvent({
      subject: "Karla quiere hacer un cambio en su reserva",
      body: "Fechas originales: 10-12 jun\nFechas solicitadas: 12-14 jun",
    });
    assert.equal(result?.kind, "MODIFICATION_REQUEST");
    assert.ok((result?.confidence ?? 0) >= 0.9);
  });

  it("detects MODIFICATION_REQUEST from date sections", () => {
    const result = classifyModificationObservabilityEvent({
      subject: "Actualización de reserva",
      body: "Fechas originales\n10 jun - 12 jun\nFechas solicitadas\n12 jun - 14 jun",
    });
    assert.equal(result?.kind, "MODIFICATION_REQUEST");
    assert.ok((result?.confidence ?? 0) >= 0.9);
  });

  it("detects MODIFICATION_APPROVED from itinerary update copy", () => {
    const result = classifyModificationObservabilityEvent({
      subject: "Tu reserva con Karla se ha actualizado",
      body: "Ya hemos actualizado el itinerario de la reserva.",
    });
    assert.equal(result?.kind, "MODIFICATION_APPROVED");
    assert.ok((result?.confidence ?? 0) >= 0.95);
  });

  it("extracts guest and date metadata for requests", () => {
    const metadata = extractModificationEventMetadata({
      eventKind: "MODIFICATION_REQUEST",
      subject: "Karla quiere hacer un cambio en su reserva",
      body: "Fechas originales: 10-12 jun\nFechas solicitadas: 12-14 jun",
      signals: { listingName: "Loft Laureles" },
    });

    assert.equal(metadata.guestName, "Karla");
    assert.equal(metadata.propertyLabel, "Loft Laureles");
    assert.match(
      buildModificationEventDescription("MODIFICATION_REQUEST", metadata),
      /Solicitud de cambio/,
    );
  });
});
