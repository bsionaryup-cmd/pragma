import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReservationActivityType } from "@prisma/client";
import {
  isPreReservationInquirySubject,
  parseInquiryDateRangeFromSubject,
  parseInquiryPropertyFromSubject,
  resolveInquiryGuestName,
  shouldIncludePendingInquiry,
} from "@/services/novedades/novedades-unlinked-inquiry.logic";

describe("novedades unlinked inquiry", () => {
  it("detecta consultas por subject", () => {
    assert.equal(
      isPreReservationInquirySubject(
        "Consulta sobre Loft moderno 4P en Laureles para el periodo 25–30 jun 2026",
      ),
      true,
    );
    assert.equal(
      isPreReservationInquirySubject("Reserva confirmada: Juan llega el 2 jul."),
      false,
    );
  });

  it("extrae propiedad y fechas del subject de consulta", () => {
    const subject =
      "Consulta sobre Loft moderno 4P | Laureles | A 10 min de Comuna 13 para el periodo 25–30 jun 2026";
    assert.equal(
      parseInquiryPropertyFromSubject(subject),
      "Loft moderno 4P | Laureles | A 10 min de Comuna 13",
    );
    assert.equal(parseInquiryDateRangeFromSubject(subject), "25–30 jun 2026");
  });

  it("resuelve nombre de huésped desde audit o sender", () => {
    assert.equal(
      resolveInquiryGuestName({
        senderName: null,
        subject: "Consulta sobre Loft 4P",
        narrative: "Hola, ¿tienen parqueadero?",
        auditGuestName: "María López",
      }),
      "María López",
    );
  });

  it("incluye mensajes de consulta con cuerpo parseable", () => {
    assert.equal(
      shouldIncludePendingInquiry({
        activityType: ReservationActivityType.AIRBNB_MESSAGE,
        subject:
          "Consulta sobre Loft moderno 4P | Laureles | A 10 min de Comuna 13 para el periodo 25–30 jun 2026",
        content:
          'Juan escribió:\n"Hola, me interesa el loft para esas fechas. ¿Está disponible?"',
        senderName: null,
        auditGuestName: null,
      }),
      true,
    );
  });

  it("excluye confirmaciones y reseñas en pending", () => {
    assert.equal(
      shouldIncludePendingInquiry({
        activityType: ReservationActivityType.AIRBNB_MESSAGE,
        subject: "Reserva confirmada: Chanelva Alidikromo llega el 25 jun.",
        content: "Nueva reserva confirmada",
        senderName: null,
        auditGuestName: "Chanelva Alidikromo",
      }),
      false,
    );
    assert.equal(
      shouldIncludePendingInquiry({
        activityType: ReservationActivityType.AIRBNB_MESSAGE,
        subject: "Milena Mercedes ha escrito una evaluación sobre ti",
        content: "Deja una evaluación",
        senderName: null,
        auditGuestName: null,
      }),
      false,
    );
  });
});
