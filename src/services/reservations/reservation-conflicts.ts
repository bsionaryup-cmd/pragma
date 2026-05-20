import { ReservationStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";

export class ReservationConflictError extends Error {
  constructor(
    message = "Las fechas seleccionadas ya están ocupadas. Elige otras fechas o sincroniza el calendario.",
  ) {
    super(message);
    this.name = "ReservationConflictError";
  }
}

/** Solapamiento estándar PMS: [checkIn, checkOut) */
export async function findOverlappingReservation(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
) {
  return db.reservation.findFirst({
    where: withVisibleReservationsFilter({
      propertyId,
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      status: {
        notIn: [ReservationStatus.CANCELLED],
      },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    }),
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      platform: true,
      icalUid: true,
      status: true,
    },
  });
}

export async function assertNoReservationOverlap(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
): Promise<void> {
  const conflict = await findOverlappingReservation(
    propertyId,
    checkIn,
    checkOut,
    excludeReservationId,
  );

  if (conflict) {
    const inDate = conflict.checkIn.toISOString().slice(0, 10);
    const outDate = conflict.checkOut.toISOString().slice(0, 10);
    throw new ReservationConflictError(
      formatOverlapMessage(conflict.guestName, inDate, outDate, conflict.status),
    );
  }
}

function formatOverlapMessage(
  guestName: string,
  checkIn: string,
  checkOut: string,
  status: ReservationStatus,
): string {
  if (status === ReservationStatus.BLOCKED) {
    return `Las fechas están bloqueadas (${checkIn} → ${checkOut}). Elige otras fechas.`;
  }
  return `Las fechas chocan con «${guestName}» (${checkIn} → ${checkOut}). Elige otras fechas.`;
}
