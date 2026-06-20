import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailEventKind } from "@prisma/client";
import {
  CANONICAL_AIRBNB_PLACEHOLDER_GUEST_NAME,
  isExactCanonicalAirbnbPlaceholder,
  resolveTrustworthyGuestNameForPlaceholder,
} from "@/modules/airbnb-email/repair/placeholder-guest-name-backfill";

describe("placeholder guest name backfill", () => {
  it("solo acepta el placeholder canónico exacto", () => {
    assert.equal(isExactCanonicalAirbnbPlaceholder("Huésped Airbnb"), true);
    assert.equal(isExactCanonicalAirbnbPlaceholder("Huesped Airbnb"), false);
    assert.equal(isExactCanonicalAirbnbPlaceholder("Roberto Gonzalez Morales"), false);
    assert.equal(
      CANONICAL_AIRBNB_PLACEHOLDER_GUEST_NAME,
      "Huésped Airbnb",
    );
  });

  it("prefiere CONFIRMED enrichedFields sobre otros eventos", () => {
    const resolved = resolveTrustworthyGuestNameForPlaceholder({
      reservationCode: "HM3QAQ54KY",
      emailEvents: [
        {
          eventKind: AirbnbEmailEventKind.UPDATED,
          confirmationCode: "HM3QAQ54KY",
          enrichedFields: { guestName: "Nombre Actualizado" },
          createdAt: new Date("2026-06-20T00:00:00Z"),
        },
        {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: "HM3QAQ54KY",
          enrichedFields: { guestName: "Carolina Dcroz Ruiz" },
          createdAt: new Date("2026-06-17T00:00:00Z"),
        },
      ],
      auditPayloads: [],
    });

    assert.equal(resolved?.guestName, "Carolina Dcroz Ruiz");
    assert.equal(resolved?.source, "email_event");
  });

  it("rechaza nombres no plausibles en enrichedFields", () => {
    const resolved = resolveTrustworthyGuestNameForPlaceholder({
      reservationCode: null,
      emailEvents: [
        {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: null,
          enrichedFields: { guestName: "Huésped Airbnb" },
          createdAt: new Date(),
        },
      ],
      auditPayloads: [],
    });

    assert.equal(resolved, null);
  });

  it("usa audit payload cuando no hay email events", () => {
    const resolved = resolveTrustworthyGuestNameForPlaceholder({
      reservationCode: null,
      emailEvents: [],
      auditPayloads: [
        { signals: { guestName: "Jairo Tapia" } },
      ],
    });

    assert.equal(resolved?.guestName, "Jairo Tapia");
    assert.equal(resolved?.source, "ingestion_audit");
  });

  it("ignora CONFIRMED con código HM distinto al de la reserva", () => {
    const resolved = resolveTrustworthyGuestNameForPlaceholder({
      reservationCode: "HMJDFHKS4R",
      emailEvents: [
        {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: "HMOTHERCODE1",
          enrichedFields: { guestName: "Otra Persona" },
          createdAt: new Date(),
        },
      ],
      auditPayloads: [],
    });

    assert.equal(resolved, null);
  });
});
