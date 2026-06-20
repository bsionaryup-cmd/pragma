import { BookingPlatform } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { splitGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import {
  extractGuestNameFromAuditPayload,
  pickGuestNameFromReservationEmailEvents,
} from "@/services/reservations/airbnb-display-guest-name.service";

/** Placeholder canónico de iCal — único valor que este backfill puede reemplazar. */
export const CANONICAL_AIRBNB_PLACEHOLDER_GUEST_NAME = "Huésped Airbnb";

export function isExactCanonicalAirbnbPlaceholder(
  guestName: string | null | undefined,
): boolean {
  return guestName?.trim() === CANONICAL_AIRBNB_PLACEHOLDER_GUEST_NAME;
}

export type PlaceholderGuestNameBackfillResolution = {
  guestName: string;
  source: "email_event" | "ingestion_audit";
};

export function resolveTrustworthyGuestNameForPlaceholder(input: {
  emailEvents: Parameters<typeof pickGuestNameFromReservationEmailEvents>[0]["events"];
  reservationCode: string | null | undefined;
  auditPayloads: unknown[];
}): PlaceholderGuestNameBackfillResolution | null {
  const fromEvents = pickGuestNameFromReservationEmailEvents({
    events: input.emailEvents,
    reservationCode: input.reservationCode,
  });
  if (fromEvents) {
    return { guestName: fromEvents, source: "email_event" };
  }

  for (const payload of input.auditPayloads) {
    const fromAudit = extractGuestNameFromAuditPayload(payload);
    if (fromAudit) {
      return { guestName: fromAudit, source: "ingestion_audit" };
    }
  }

  return null;
}

export async function applyPlaceholderGuestNameBackfill(input: {
  reservationId: string;
  guestName: string;
  dryRun?: boolean;
}): Promise<{ applied: boolean; guestName: string }> {
  const split = splitGuestName(input.guestName);

  if (!input.dryRun) {
    await db.reservation.update({
      where: { id: input.reservationId },
      data: {
        guestName: split.guestName,
        guestFirstName: split.guestFirstName,
        guestLastName: split.guestLastName,
      },
    });

    airbnbEmailLog.info("placeholder_guest_name_backfill_applied", {
      reservationId: input.reservationId,
      guestName: split.guestName,
    });
  }

  return { applied: true, guestName: split.guestName };
}
