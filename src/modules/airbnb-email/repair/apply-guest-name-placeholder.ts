import { AirbnbEmailEventKind } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import {
  isPlaceholderGuestName,
  splitGuestName,
} from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

const GUEST_NAME_SOURCE_EVENT_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
]);

function readSignalsFromAuditPayload(payload: unknown): ExtractedReservationSignals | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const signals = root.signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  return signals as ExtractedReservationSignals;
}

export type ApplyGuestNameToPlaceholderResult =
  | { status: "applied"; guestName: string }
  | { status: "skipped"; reason: string };

export async function applyGuestNameToPlaceholderReservation(input: {
  reservationId: string;
  auditId: string;
  eventKind: AirbnbEmailEventKind;
}): Promise<ApplyGuestNameToPlaceholderResult> {
  if (!GUEST_NAME_SOURCE_EVENT_KINDS.has(input.eventKind)) {
    return { status: "skipped", reason: "event_kind_not_guest_name_source" };
  }

  const [reservation, audit] = await Promise.all([
    db.reservation.findUnique({
      where: { id: input.reservationId },
      select: {
        guestName: true,
        guestRegistrationCompletedAt: true,
      },
    }),
    db.emailIngestionAudit.findUnique({
      where: { id: input.auditId },
      select: { parsedPayload: true },
    }),
  ]);

  if (!reservation) {
    return { status: "skipped", reason: "reservation_not_found" };
  }
  if (reservation.guestRegistrationCompletedAt) {
    return { status: "skipped", reason: "guest_registration_locked" };
  }
  if (!isPlaceholderGuestName(reservation.guestName)) {
    return { status: "skipped", reason: "guest_name_not_placeholder" };
  }

  const signals = readSignalsFromAuditPayload(audit?.parsedPayload);
  const guestNameRaw = signals?.guestName?.trim();
  if (!guestNameRaw || !isPlausibleGuestName(guestNameRaw)) {
    return { status: "skipped", reason: "audit_guest_name_not_plausible" };
  }

  const split = splitGuestName(guestNameRaw);
  await db.reservation.update({
    where: { id: input.reservationId },
    data: {
      guestName: split.guestName,
      guestFirstName: split.guestFirstName,
      guestLastName: split.guestLastName,
    },
  });

  airbnbEmailLog.info("linkage_placeholder_guest_name_applied", {
    reservationId: input.reservationId,
    auditId: input.auditId,
    guestName: split.guestName,
  });

  return { status: "applied", guestName: split.guestName };
}
