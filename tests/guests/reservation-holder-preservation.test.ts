import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailEventKind } from "@prisma/client";
import {
  isPlaceholderGuestName,
  mergeEnrichedFieldsForEmailEvent,
} from "@/modules/airbnb-email/domains/safe-reservation-enrichment";

describe("reservation holder preservation", () => {
  it("keeps María as titular — not a placeholder name", () => {
    assert.equal(isPlaceholderGuestName("María García"), false);
  });

  it("María reservó: enrichment CONFIRMED no reemplaza titular por Juan", () => {
    const merged = mergeEnrichedFieldsForEmailEvent({
      reservationEnrichedFields: { guestName: "María García" },
      metadataFields: {},
      signals: { guestName: "Juan Pérez" },
      eventKind: AirbnbEmailEventKind.CONFIRMED,
    });
    assert.equal(merged.guestName, "María García");
  });

  it("solo placeholders iCal pueden recibir nombre desde enrichment", () => {
    const merged = mergeEnrichedFieldsForEmailEvent({
      reservationEnrichedFields: { guestName: "Huésped Airbnb" },
      metadataFields: {},
      signals: { guestName: "María García" },
      eventKind: AirbnbEmailEventKind.CONFIRMED,
    });
    assert.equal(merged.guestName, "María García");
  });

  it("UPDATED no cambia titular aunque el signal traiga otro nombre", () => {
    const merged = mergeEnrichedFieldsForEmailEvent({
      reservationEnrichedFields: { guestName: "María García" },
      metadataFields: {},
      signals: { guestName: "Ana López" },
      eventKind: AirbnbEmailEventKind.UPDATED,
    });
    assert.equal(merged.guestName, "María García");
  });
});
