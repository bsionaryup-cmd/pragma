import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";

/**
 * Reproduces the production failure mode:
 * reservation.guestName stays as iCal pseudo-name after GR (OCP Phase 2),
 * while ReservationGuest.fullName holds the real registered guest.
 * TTLock keyboardPwdName must use the registered guest.
 */
describe("TTLock keyboardPwdName after guest registration", () => {
  it("maps UIVis Guest-* iCal label to registered guest for TTLock", () => {
    const icalName = "UIVis Guest-06AA2915";
    assert.equal(isPlaceholderGuestName(icalName), true);

    const keyboardPwdName = resolveReservationDisplayGuestName({
      platform: BookingPlatform.AIRBNB,
      guestName: icalName,
      primaryGuestName: "Carlos Andrés Mejía",
      guestRegistrationCompletedAt: "2026-11-22T12:00:00.000Z",
      airbnbEnrichmentGuestName: null,
    }).slice(0, 50);

    assert.equal(keyboardPwdName, "Carlos Andrés Mejía");
    assert.notEqual(keyboardPwdName, icalName);
  });

  it("keeps enrichment before registration completes", () => {
    const label = resolveReservationDisplayGuestName({
      platform: BookingPlatform.AIRBNB,
      guestName: "UIVis Guest-06AA2915",
      primaryGuestName: null,
      guestRegistrationCompletedAt: null,
      airbnbEnrichmentGuestName: "Carlos Andrés Mejía",
    });
    assert.equal(label, "Carlos Andrés Mejía");
  });
});
