import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BookingPlatform } from "@prisma/client";
import { resolveFinanceGuestDisplayName } from "@/lib/finance/finance-guest-display";

describe("finance guest display", () => {
  it("uses enriched Airbnb guest name when reservation placeholder is generic", () => {
    const name = resolveFinanceGuestDisplayName(
      {
        platform: BookingPlatform.AIRBNB,
        guestName: "Huésped Airbnb",
        guestRegistrationCompletedAt: null,
      },
      {
        enrichedFields: { guestName: "María García" },
        payloadSignals: null,
        emailMatchBlob: null,
        payoutNet: null,
      },
    );
    assert.equal(name, "María García");
  });

  it("prefers registered guest name after check-in registration", () => {
    const name = resolveFinanceGuestDisplayName(
      {
        platform: BookingPlatform.AIRBNB,
        guestName: "Carlos Pérez",
        guestRegistrationCompletedAt: new Date("2026-05-01"),
      },
      {
        enrichedFields: { guestName: "María García" },
        payloadSignals: null,
        emailMatchBlob: null,
        payoutNet: null,
      },
    );
    assert.equal(name, "Carlos Pérez");
  });
});
