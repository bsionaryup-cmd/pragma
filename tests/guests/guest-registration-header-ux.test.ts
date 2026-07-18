import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDate } from "../../src/lib/helpers/date";
import { isPlaceholderGuestName } from "../../src/modules/airbnb-email/domains/safe-reservation-enrichment";
import { isPlausibleGuestName } from "../../src/modules/airbnb-email/parsing/guest-name-extract";

/**
 * Mirrors holderDisplayName resolution used by buildGuestRegistrationReservationView
 * (kept local so the UX contract is tested without loading server-only GR service).
 */
function resolveHolderDisplayName(input: {
  ownerFullName: string | null;
  reservationGuestName: string | null;
}): string | null {
  const ownerName = input.ownerFullName?.trim() || null;
  if (ownerName) return ownerName;
  const reservationGuestName = input.reservationGuestName?.trim() || null;
  if (
    reservationGuestName &&
    !isPlaceholderGuestName(reservationGuestName) &&
    isPlausibleGuestName(reservationGuestName)
  ) {
    return reservationGuestName;
  }
  return null;
}

describe("Guest Registration header UX — holder display name", () => {
  it("prefers reservation owner full name", () => {
    assert.equal(
      resolveHolderDisplayName({
        ownerFullName: "Tachi Yamel Silva Martinez",
        reservationGuestName: "Huésped Airbnb",
      }),
      "Tachi Yamel Silva Martinez",
    );
  });

  it("falls back to plausible reservation guestName", () => {
    assert.equal(
      resolveHolderDisplayName({
        ownerFullName: null,
        reservationGuestName: "Juan Pérez",
      }),
      "Juan Pérez",
    );
  });

  it("returns null for placeholder Airbnb names (welcome without personal name)", () => {
    assert.equal(
      resolveHolderDisplayName({
        ownerFullName: null,
        reservationGuestName: "Huésped Airbnb",
      }),
      null,
    );
  });

  it("formats stay dates in es-CO for the header", () => {
    assert.match(formatDate("2026-07-23"), /23/);
    assert.match(formatDate("2026-07-23"), /2026/);
  });
});
