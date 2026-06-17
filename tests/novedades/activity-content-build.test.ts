import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildActivityContent } from "@/modules/reservation-activity/parsing/activity-content-build";
import { resolveGuestMessageBodiesForDisplay } from "@/services/novedades/operational-feed.message";

const JAIRO_EMAIL = `Reserva de «Loft amplio 4P con Vista Panorámica | Laureles Top», 23–27 jun
Por tu seguridad y protección, comunícate siempre a través de la plataforma de Airbnb.
Jairo
Persona que reserva
Una pregunta de casualidad hay disponible del 21 al 23 hospedaje
Jairo
Persona que reserva
Porque queremos viajar antes de las elecciones`;

describe("activity content build", () => {
  it("stores raw email body when ingest-time parse lacks guest name", () => {
    const built = buildActivityContent({
      activityType: "AIRBNB_MESSAGE",
      subject: "Huésped Airbnb te envió un mensaje sobre su reserva",
      body: JAIRO_EMAIL,
      from: "urbanovaloft@gmail.com",
      signals: {
        guestName: "Huésped Airbnb",
        messageBody: JAIRO_EMAIL,
      },
    });

    assert.ok(built.content.trim().length > 0);
    assert.equal(built.metadata.rawMessageBody, JAIRO_EMAIL);

    const bodies = resolveGuestMessageBodiesForDisplay(built.metadata.rawMessageBody, {
      guestName: "Jairo",
    });
    assert.equal(bodies.length, 2);
    assert.match(bodies[0] ?? "", /disponible del 21 al 23/i);
  });
});
