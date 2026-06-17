import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeGuestMessageBody,
  resolveGuestMessageForDisplay,
  resolveGuestMessageBodiesForDisplay,
} from "@/services/novedades/operational-feed.message";
import {
  detectNovedadesStayStage,
  novedadesStayStageLabel,
} from "@/services/novedades/novedades-stay-stage";
import { detectGuestMessageIntent } from "@/services/novedades/novedades-suggested-actions.service";

describe("guest message parsing", () => {
  it("strips Airbnb subject boilerplate and keeps guest text", () => {
    const parsed = normalizeGuestMessageBody(
      'Ana García te envió un mensaje sobre su reserva\n\n"¿Podemos llegar a las 2pm?"',
    );
    assert.equal(parsed, "¿Podemos llegar a las 2pm?");
  });

  it("extracts wrote: snippet from forwarded email body", () => {
    const parsed = normalizeGuestMessageBody(
      "Message from Guest about your reservation\nGuest wrote: Can we check in early at 11am?",
    );
    assert.match(parsed ?? "", /check in early/i);
  });

  it("does not return subject line as message", () => {
    const parsed = resolveGuestMessageForDisplay(
      "Karla Durán te envió un mensaje sobre su reserva",
    );
    assert.equal(parsed, null);
  });

  it("strips Airbnb footers and keeps the guest paragraph", () => {
    const parsed = normalizeGuestMessageBody(
      `Karla Durán te envió un mensaje sobre su reserva

"¿Podemos llegar mañana a las 11am?"

--
Responder en Airbnb
Ver reserva
Código de confirmación HM8K2P9Q4X`,
    );
    assert.equal(parsed, "¿Podemos llegar mañana a las 11am?");
  });

  it("drops unsubscribe links wrapped in parentheses", () => {
    const parsed = normalizeGuestMessageBody(
      "(https://www.airbnb.com/ac/account-settings/email-unsubscribe?mac=abc123xyz)",
    );
    assert.equal(parsed, null);
  });

  it("removes spanish header style 'a nombre envio un mensaje'", () => {
    const parsed = normalizeGuestMessageBody(
      "a Jairo Envió un mensaje\n\nHola Samuel, llegamos a las 4pm",
    );
    assert.equal(parsed, "Hola Samuel, llegamos a las 4pm");
  });

  it("extracts gmail-style blocks with Persona que reserva label", () => {
    const parsed = normalizeGuestMessageBody(
      `Jairo
Persona que reserva
Una pregunta de casualidad hay disponible del 21 al 23 hospedaje

Jairo
Persona que reserva
Porque queremos viajar antes de las elecciones`,
      { guestName: "Jairo Tapia" },
    );
    assert.match(parsed ?? "", /disponible del 21 al 23/i);
    assert.match(parsed ?? "", /elecciones/i);
  });

  it("extracts concatenated guest messages from a single line", () => {
    const parsed = normalizeGuestMessageBody(
      "Jairo Persona que reserva Hola Jairo Persona que reserva Que más Samuel Jairo Persona que reserva Cómo estás",
      { guestName: "Jairo" },
    );
    assert.match(parsed ?? "", /Hola/i);
    assert.match(parsed ?? "", /Que más Samuel/i);
    assert.match(parsed ?? "", /Cómo estás/i);
  });

  it("rejects airbnb response-rate reminders", () => {
    const parsed = normalizeGuestMessageBody(
      "Cuanto antes respondas, más tiempo tendrán los viajeros para organizar el viaje. Si no contestas a la solicitud de Jasser en 24 horas, la ratio de respuesta y el lugar que ocupa tu anuncio en los resultados de búsqueda pueden verse afectados.",
    );
    assert.equal(parsed, null);
  });

  it("rejects com.co unsubscribe links in brackets", () => {
    const parsed = normalizeGuestMessageBody(
      "[https://www.airbnb.com.co/account-settings/email-unsubscribe?mac=1F37pxrMJ1zbireztRX3CG7NNRo=&token=eyJ1]",
    );
    assert.equal(parsed, null);
  });

  it("rejects send-message-to-guest boilerplate", () => {
    const parsed = normalizeGuestMessageBody('"a JairoEnvía un mensaje a Jairo"');
    assert.equal(parsed, null);
  });

  it("keeps short guest greetings like Hola", () => {
    const parsed = normalizeGuestMessageBody("Hola", { guestName: "Jairo" });
    assert.equal(parsed, "Hola");
  });

  it("splits airbnb email thread into separate guest bodies (Jairo case)", () => {
    const raw = `Reserva de «Loft amplio 4P con Vista Panorámica | Laureles Top», 23–27 jun
Por tu seguridad y protección, comunícate siempre a través de la plataforma de Airbnb.
Jairo
Persona que reserva
Una pregunta de casualidad hay disponible del 21 al 23 hospedaje
Jairo
Persona que reserva
Porque queremos viajar antes de las elecciones`;

    const bodies = resolveGuestMessageBodiesForDisplay(raw, { guestName: "Jairo" });
    assert.equal(bodies.length, 2);
    assert.match(bodies[0] ?? "", /disponible del 21 al 23/i);
    assert.match(bodies[1] ?? "", /elecciones/i);
    assert.doesNotMatch(bodies.join(" "), /persona que reserva/i);
    assert.doesNotMatch(bodies.join(" "), /comunícate siempre/i);
  });
});

describe("guest message intent", () => {
  it("detects early check-in questions", () => {
    assert.equal(
      detectGuestMessageIntent("¿Podemos hacer check-in a las 11am?"),
      "EARLY_CHECKIN",
    );
  });

  it("detects wifi questions", () => {
    assert.equal(detectGuestMessageIntent("Cuál es la clave del wifi?"), "WIFI");
  });
});

describe("stay stage", () => {
  it("labels new bookings far from check-in", () => {
    const stage = detectNovedadesStayStage({
      status: "CONFIRMED",
      checkIn: "2026-08-01",
      checkOut: "2026-08-05",
      now: new Date("2026-06-16T12:00:00Z"),
    });
    assert.equal(stage, "NEW_BOOKING");
    assert.equal(novedadesStayStageLabel(stage), "Nueva reserva");
  });

  it("detects check-in day", () => {
    const stage = detectNovedadesStayStage({
      status: "CONFIRMED",
      checkIn: "2026-06-16",
      checkOut: "2026-06-20",
      now: new Date("2026-06-16T12:00:00Z"),
    });
    assert.equal(stage, "CHECK_IN_DAY");
  });
});
