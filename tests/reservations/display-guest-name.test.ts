import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";

const registeredAt = "2026-06-16T00:10:12.994Z";

function resolveAirbnbDisplay(input: {
  guestName: string;
  airbnbEnrichmentGuestName: string | null;
  guestRegistrationCompletedAt?: string | null;
}) {
  return resolveReservationDisplayGuestName({
    platform: BookingPlatform.AIRBNB,
    guestName: input.guestName,
    airbnbEnrichmentGuestName: input.airbnbEnrichmentGuestName,
    guestRegistrationCompletedAt: input.guestRegistrationCompletedAt ?? null,
  });
}

describe("resolveReservationDisplayGuestName registered guest priority", () => {
  it("Yuly: registered row name wins over Airbnb enrichment", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Yuly Escarley Correa cordero",
        airbnbEnrichmentGuestName: "Yuly Correa",
        guestRegistrationCompletedAt: registeredAt,
      }),
      "Yuly Escarley Correa cordero",
    );
  });

  it("Milena: registered row name wins over longer Airbnb enrichment", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Milena Barrero",
        airbnbEnrichmentGuestName: "Milena Mercedes Barrero Cortes",
        guestRegistrationCompletedAt: "2026-06-10T19:38:52.120Z",
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

  it("Karla: without completed registration, enrichment still wins", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Huésped Airbnb",
        airbnbEnrichmentGuestName: "Karla Durán",
        guestRegistrationCompletedAt: null,
      }),
      "Karla Durán",
    );
  });
});
