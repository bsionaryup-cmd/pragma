import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyReservationActivityEmail,
  resolveActivityCaptureType,
} from "@/modules/reservation-activity/classifiers/activity-email-classifier";
import { AirbnbEmailEventKind } from "@prisma/client";

describe("reservation activity email classifier", () => {
  it("detects MODIFICATION_REQUEST before guest message heuristics", () => {
    const result = classifyReservationActivityEmail({
      subject: "Karla quiere hacer un cambio en su reserva",
      body: "Fechas originales\n19 jun → 23 jun\nFechas solicitadas\n18 jun → 23 jun",
    });
    assert.equal(result?.activityType, "MODIFICATION_REQUEST");
    assert.ok((result?.confidence ?? 0) >= 0.9);
  });

  it("detects MODIFICATION_APPROVED from itinerary update copy", () => {
    const result = classifyReservationActivityEmail({
      subject: "Tu reserva con Karla se ha actualizado",
      body: "Ya hemos actualizado el itinerario de la reserva.",
    });
    assert.equal(result?.activityType, "MODIFICATION_APPROVED");
  });

  it("detects AIRBNB_MESSAGE from pipeline event kind", () => {
    const result = classifyReservationActivityEmail({
      subject: "Nuevo mensaje de Karla",
      body: "Hola Samuel, modifiqué la reserva porque nuestro vuelo llega por la madrugada.",
      messageBody:
        "Hola Samuel, modifiqué la reserva porque nuestro vuelo llega por la madrugada.",
      pipelineEventKind: AirbnbEmailEventKind.RESERVATION_MESSAGE,
    });
    assert.equal(result?.activityType, "AIRBNB_MESSAGE");
  });

  it("prefers guest message subject over TRANSPORT_REQUEST pipeline kind", () => {
    const result = classifyReservationActivityEmail({
      subject: "RE: Reserva de «Loft amplio 4P con Vista Panorámica | Laureles Top», 18–23 jun",
      body: "Reserva de loft\nKarla\nPersona que reserva\nHola, ¿a qué hora puedo llegar?",
      pipelineEventKind: AirbnbEmailEventKind.TRANSPORT_REQUEST,
    });
    assert.equal(result?.activityType, "AIRBNB_MESSAGE");
  });

  it("stores UNMATCHED_AIRBNB when no pattern matches", () => {
    const result = resolveActivityCaptureType({
      subject: "Reservation inquiry for your listing",
      body: "A guest asked about availability next month.",
    });
    assert.equal(result.activityType, "UNMATCHED_AIRBNB");
    assert.equal(result.confidence, 0.5);
  });
});
