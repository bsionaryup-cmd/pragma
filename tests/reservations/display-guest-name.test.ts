import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";

const registeredAt = "2026-06-16T00:10:12.994Z";

function resolveAirbnbDisplay(input: {
  guestName: string;
  airbnbEnrichmentGuestName: string | null;
  primaryGuestName?: string | null;
  guestRegistrationCompletedAt?: string | null;
}) {
  return resolveReservationDisplayGuestName({
    platform: BookingPlatform.AIRBNB,
    guestName: input.guestName,
    airbnbEnrichmentGuestName: input.airbnbEnrichmentGuestName,
    primaryGuestName: input.primaryGuestName ?? null,
    guestRegistrationCompletedAt: input.guestRegistrationCompletedAt ?? null,
  });
}

describe("resolveReservationDisplayGuestName registered guest priority", () => {
  it("Yuly: registered ReservationGuest wins over Airbnb enrichment", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Huésped Airbnb",
        primaryGuestName: "Yuly Escarley Correa cordero",
        airbnbEnrichmentGuestName: "Yuly Correa",
        guestRegistrationCompletedAt: registeredAt,
      }),
      "Yuly Escarley Correa cordero",
    );
  });

  it("Milena: registered ReservationGuest wins over longer Airbnb enrichment", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "Huésped Airbnb",
        primaryGuestName: "Milena Barrero",
        airbnbEnrichmentGuestName: "Milena Mercedes Barrero Cortes",
        guestRegistrationCompletedAt: "2026-06-10T19:38:52.120Z",
      }),
      "Milena Barrero",
    );
  });

  it("UIVis: iCal pseudo-name must not beat registered guest for TTLock label", () => {
    assert.equal(
      resolveAirbnbDisplay({
        guestName: "UIVis Guest-06AA2915",
        primaryGuestName: "María López García",
        airbnbEnrichmentGuestName: null,
        guestRegistrationCompletedAt: registeredAt,
      }),
      "María López García",
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
