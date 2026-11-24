import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";

const registeredAt = "2026-06-16T00:10:12.994Z";

function resolveAirbnbDisplay(input: {
  guestName: string;
  airbnbEnrichmentGuestName: string | null;
  guestRegistrationCompletedAt?: string | null;
  primaryGuestName?: string | null;
}) {
  return resolveReservationDisplayGuestName({
    platform: BookingPlatform.AIRBNB,
    guestName: input.guestName,
    airbnbEnrichmentGuestName: input.airbnbEnrichmentGuestName,
    guestRegistrationCompletedAt: input.guestRegistrationCompletedAt ?? null,
    primaryGuestName: input.primaryGuestName ?? null,
  });
}

describe("resolveReservationDisplayGuestName channel titular SSOT", () => {
  it("channel enrichment wins over GR-overwritten row name", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Luis Francisco Campos Hernández",
        airbnbEnrichmentGuestName: "Sergio Andres Mantilla Plata",
        guestRegistrationCompletedAt: registeredAt,
      }),
      "Sergio Andres Mantilla Plata",
    );
  });

  it("channel enrichment wins over shorter registered-style row name", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Yuly Escarley Correa cordero",
        airbnbEnrichmentGuestName: "Yuly Correa",
        guestRegistrationCompletedAt: registeredAt,
      }),
      "Yuly Correa",
    );
  });

  it("without enrichment, non-placeholder row name is used", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Milena Barrero",
        airbnbEnrichmentGuestName: null,
        guestRegistrationCompletedAt: registeredAt,
      }),
      "Milena Barrero",
    );
  });

  it("Jairo: without completed registration, enrichment still wins", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Huésped Airbnb",
        airbnbEnrichmentGuestName: "Jairo Tapia",
        guestRegistrationCompletedAt: null,
      }),
      "Jairo Tapia",
    );
  });

  it("placeholder row + enrichment: enrichment wins even after GR", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Huésped Airbnb",
        airbnbEnrichmentGuestName: "Sergio Andres Mantilla Plata",
        guestRegistrationCompletedAt: registeredAt,
      }),
      "Sergio Andres Mantilla Plata",
    );
  });

  it("no enrichment + placeholder: falls back to registered primary guest", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Huésped Airbnb",
        airbnbEnrichmentGuestName: null,
        guestRegistrationCompletedAt: registeredAt,
        primaryGuestName: "Luis Francisco Campos Hernández",
      }),
      "Luis Francisco Campos Hernández",
    );
  });
});
