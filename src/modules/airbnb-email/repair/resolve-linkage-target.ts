import { ReservationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

function parseDateKey(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) {
    const d = new Date(`${iso}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readSignalsFromAuditPayload(payload: unknown): ExtractedReservationSignals | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const signals = root.signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  return signals as ExtractedReservationSignals;
}

function datesOverlap(
  aCheckIn: Date,
  aCheckOut: Date,
  bCheckIn: Date,
  bCheckOut: Date,
): boolean {
  return aCheckIn < bCheckOut && aCheckOut > bCheckIn;
}

export type ResolveLinkageTargetResult =
  | { status: "resolved"; reservationId: string; method: "confirmation_code" | "placeholder_dates" }
  | { status: "ambiguous"; candidateIds: string[] }
  | { status: "unresolved"; reason: string };

export async function resolveLinkageTargetReservation(input: {
  confirmationCode: string;
  propertyId: string;
  auditParsedPayload: unknown;
}): Promise<ResolveLinkageTargetResult> {
  const code = input.confirmationCode.trim();
  if (!code) {
    return { status: "unresolved", reason: "missing_confirmation_code" };
  }

  const byCode = await db.reservation.findMany({
    where: {
      propertyId: input.propertyId,
      reservationCode: { equals: code, mode: "insensitive" },
      status: { not: ReservationStatus.CANCELLED },
    },
    select: { id: true },
  });
  if (byCode.length === 1) {
    return {
      status: "resolved",
      reservationId: byCode[0]!.id,
      method: "confirmation_code",
    };
  }
  if (byCode.length > 1) {
    return { status: "ambiguous", candidateIds: byCode.map((r) => r.id) };
  }

  const signals = readSignalsFromAuditPayload(input.auditParsedPayload);
  const signalCheckIn = parseDateKey(signals?.checkIn ?? null);
  const signalCheckOut = parseDateKey(signals?.checkOut ?? null);
  if (!signalCheckIn || !signalCheckOut) {
    return { status: "unresolved", reason: "missing_audit_stay_dates" };
  }

  const placeholders = await db.reservation.findMany({
    where: {
      propertyId: input.propertyId,
      reservationCode: null,
      status: { not: ReservationStatus.CANCELLED },
      checkIn: { lte: signalCheckOut },
      checkOut: { gte: signalCheckIn },
    },
    select: { id: true, checkIn: true, checkOut: true },
  });

  const overlapping = placeholders.filter((row) =>
    datesOverlap(row.checkIn, row.checkOut, signalCheckIn, signalCheckOut),
  );
  if (overlapping.length === 1) {
    return {
      status: "resolved",
      reservationId: overlapping[0]!.id,
      method: "placeholder_dates",
    };
  }
  if (overlapping.length > 1) {
    return { status: "ambiguous", candidateIds: overlapping.map((r) => r.id) };
  }

  return { status: "unresolved", reason: "no_unique_target" };
}

export async function assignReservationCodeFillEmpty(input: {
  runId: string;
  reservationId: string;
  confirmationCode: string;
  sourceAuditId: string;
}): Promise<{ status: "applied" | "skipped"; reason?: string }> {
  const code = input.confirmationCode.trim();
  if (!code) return { status: "skipped", reason: "missing_code" };

  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    select: { reservationCode: true },
  });
  if (!reservation) return { status: "skipped", reason: "reservation_not_found" };
  if (reservation.reservationCode?.trim()) {
    return { status: "skipped", reason: "reservation_code_already_set" };
  }

  const codeTaken = await db.reservation.findFirst({
    where: {
      reservationCode: { equals: code, mode: "insensitive" },
      id: { not: input.reservationId },
    },
    select: { id: true },
  });
  if (codeTaken) {
    return { status: "skipped", reason: "code_already_on_other_reservation" };
  }

  await db.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: input.reservationId },
      data: { reservationCode: code.toUpperCase() },
    });
    await tx.airbnbReservationCodeAssignment.create({
      data: {
        runId: input.runId,
        reservationId: input.reservationId,
        assignedCode: code.toUpperCase(),
        sourceAuditId: input.sourceAuditId,
        previousCode: null,
      },
    });
  });

  return { status: "applied" };
}
