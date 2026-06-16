import type { Prisma } from "@prisma/client";
import {
  AirbnbEmailEventKind,
  AirbnbEmailLinkageRelocationStatus,
  AirbnbEmailLinkageRepairReason,
  ReservationStatus,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { confirmationCodesConflict } from "@/modules/airbnb-email/matching/confirmation-code-guard";

const REPAIRABLE_EVENT_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
  AirbnbEmailEventKind.CHECKIN_REMINDER,
]);

export type LinkageRelocationPreviousState = {
  audit: {
    reservationId: string | null;
    propertyId: string | null;
    organizationId: string | null;
  };
  event: {
    reservationId: string | null;
  };
};

export type RelinkIdsOnlyInput = {
  runId: string;
  eventId: string;
  auditId: string;
  confirmationCode: string | null;
  fromReservationId: string;
  toReservationId: string;
  reason?: AirbnbEmailLinkageRepairReason;
};

export type RelinkIdsOnlyResult =
  | { status: "applied"; relocationId: string }
  | { status: "noop"; reason: string }
  | { status: "skipped"; reason: string };

export async function relinkIdsOnly(
  input: RelinkIdsOnlyInput,
): Promise<RelinkIdsOnlyResult> {
  if (input.fromReservationId === input.toReservationId) {
    return { status: "noop", reason: "already_on_target" };
  }

  const existingApplied = await db.airbnbEmailLinkageRelocation.findFirst({
    where: {
      eventId: input.eventId,
      status: AirbnbEmailLinkageRelocationStatus.APPLIED,
      toReservationId: input.toReservationId,
    },
    select: { id: true },
  });
  if (existingApplied) {
    return { status: "noop", reason: "already_relocated" };
  }

  const [event, audit] = await Promise.all([
    db.reservationEmailEvent.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        auditId: true,
        reservationId: true,
        confirmationCode: true,
        eventKind: true,
      },
    }),
    db.emailIngestionAudit.findUnique({
      where: { id: input.auditId },
      select: {
        id: true,
        reservationId: true,
        propertyId: true,
        organizationId: true,
      },
    }),
  ]);

  if (!event || !audit) {
    return { status: "skipped", reason: "event_or_audit_missing" };
  }
  if (event.auditId !== audit.id) {
    return { status: "skipped", reason: "audit_event_mismatch" };
  }
  if (!REPAIRABLE_EVENT_KINDS.has(event.eventKind)) {
    return { status: "skipped", reason: "event_kind_not_repairable" };
  }

  const target = await db.reservation.findUnique({
    where: { id: input.toReservationId },
    select: { id: true, status: true, propertyId: true },
  });
  if (!target || target.status === ReservationStatus.CANCELLED) {
    return { status: "skipped", reason: "target_invalid_or_cancelled" };
  }

  const previousState: LinkageRelocationPreviousState = {
    audit: {
      reservationId: audit.reservationId,
      propertyId: audit.propertyId,
      organizationId: audit.organizationId,
    },
    event: {
      reservationId: event.reservationId,
    },
  };

  const relocation = await db.$transaction(async (tx) => {
    const row = await tx.airbnbEmailLinkageRelocation.create({
      data: {
        runId: input.runId,
        eventId: input.eventId,
        auditId: input.auditId,
        confirmationCode: input.confirmationCode,
        fromReservationId: input.fromReservationId,
        toReservationId: input.toReservationId,
        reason:
          input.reason ??
          AirbnbEmailLinkageRepairReason.CONFIRMATION_CODE_TARGET_MISMATCH,
        previousState: previousState as unknown as Prisma.InputJsonValue,
        status: AirbnbEmailLinkageRelocationStatus.PENDING,
      },
    });

    await tx.emailIngestionAudit.update({
      where: { id: input.auditId },
      data: { reservationId: input.toReservationId },
    });

    await tx.reservationEmailEvent.update({
      where: { id: input.eventId },
      data: { reservationId: input.toReservationId },
    });

    await tx.airbnbEmailLinkageRelocation.update({
      where: { id: row.id },
      data: {
        status: AirbnbEmailLinkageRelocationStatus.APPLIED,
        appliedAt: new Date(),
      },
    });

    return row;
  });

  airbnbEmailLog.info("linkage_relink_applied", {
    runId: input.runId,
    relocationId: relocation.id,
    eventId: input.eventId,
    auditId: input.auditId,
    fromReservationId: input.fromReservationId,
    toReservationId: input.toReservationId,
    confirmationCode: input.confirmationCode ?? undefined,
  });

  return { status: "applied", relocationId: relocation.id };
}

export async function revertLinkageRelocation(input: {
  relocationId: string;
  revertedByRunId: string;
}): Promise<{ status: "reverted" | "skipped"; reason?: string }> {
  const relocation = await db.airbnbEmailLinkageRelocation.findUnique({
    where: { id: input.relocationId },
  });
  if (!relocation || relocation.status !== AirbnbEmailLinkageRelocationStatus.APPLIED) {
    return { status: "skipped", reason: "not_applied" };
  }

  const previousState = relocation.previousState as LinkageRelocationPreviousState;

  await db.$transaction(async (tx) => {
    await tx.emailIngestionAudit.update({
      where: { id: relocation.auditId },
      data: {
        reservationId: previousState.audit.reservationId,
        propertyId: previousState.audit.propertyId,
        organizationId: previousState.audit.organizationId,
      },
    });
    await tx.reservationEmailEvent.update({
      where: { id: relocation.eventId },
      data: { reservationId: previousState.event.reservationId },
    });
    await tx.airbnbEmailLinkageRelocation.update({
      where: { id: relocation.id },
      data: {
        status: AirbnbEmailLinkageRelocationStatus.REVERTED,
        revertedAt: new Date(),
        revertedByRunId: input.revertedByRunId,
      },
    });
  });

  return { status: "reverted" };
}

export type LinkageConflictCandidate = {
  eventId: string;
  auditId: string;
  eventKind: AirbnbEmailEventKind;
  confirmationCode: string;
  fromReservationId: string;
  fromReservationCode: string;
  propertyId: string;
  organizationId: string;
};

export async function findLinkageConflictCandidates(input?: {
  organizationId?: string;
}): Promise<LinkageConflictCandidate[]> {
  const events = await db.reservationEmailEvent.findMany({
    where: {
      reservationId: { not: null },
      confirmationCode: { not: null },
      reservation: {
        reservationCode: { not: null },
        ...(input?.organizationId
          ? { property: { organizationId: input.organizationId } }
          : {}),
      },
    },
    select: {
      id: true,
      auditId: true,
      eventKind: true,
      confirmationCode: true,
      reservationId: true,
      reservation: {
        select: {
          reservationCode: true,
          propertyId: true,
          property: { select: { organizationId: true } },
        },
      },
    },
  });

  const candidates: LinkageConflictCandidate[] = [];
  for (const event of events) {
    if (!event.reservationId || !event.confirmationCode) continue;
    if (!event.reservation?.reservationCode) continue;
    if (!REPAIRABLE_EVENT_KINDS.has(event.eventKind)) continue;
    if (
      !confirmationCodesConflict(
        event.confirmationCode,
        event.reservation.reservationCode,
      )
    ) {
      continue;
    }
    const organizationId = event.reservation.property.organizationId;
    if (!organizationId) continue;
    candidates.push({
      eventId: event.id,
      auditId: event.auditId,
      eventKind: event.eventKind,
      confirmationCode: event.confirmationCode,
      fromReservationId: event.reservationId,
      fromReservationCode: event.reservation.reservationCode,
      propertyId: event.reservation.propertyId,
      organizationId,
    });
  }
  return candidates;
}
