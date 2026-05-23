import {
  onReservationCancelledForTTLock,
  onReservationCheckedOutForTTLock,
  onReservationConfirmedForTTLock,
  onReservationModifiedForTTLock,
} from "@/services/integrations/ttlock/ttlock-reservation.hooks";

export type ReservationAccessContext = {
  reservationId: string;
  propertyId: string;
  ownerId: string;
  organizationId?: string | null;
  checkIn?: Date;
  checkOut?: Date;
  status?: string;
  guestRegistrationCompleted?: boolean;
};

export async function emitBookingConfirmed(ctx: ReservationAccessContext) {
  await onReservationConfirmedForTTLock({
    reservationId: ctx.reservationId,
    propertyId: ctx.propertyId,
    ownerId: ctx.ownerId,
  });
}

export async function emitBookingModified(ctx: ReservationAccessContext) {
  await onReservationModifiedForTTLock({
    reservationId: ctx.reservationId,
    propertyId: ctx.propertyId,
    ownerId: ctx.ownerId,
    checkIn: ctx.checkIn!,
    checkOut: ctx.checkOut!,
    guestRegistrationCompleted: ctx.guestRegistrationCompleted ?? false,
  });
}

export async function emitBookingCheckedOut(ctx: ReservationAccessContext) {
  await onReservationCheckedOutForTTLock({
    reservationId: ctx.reservationId,
    propertyId: ctx.propertyId,
    ownerId: ctx.ownerId,
  });
}

export async function emitBookingCancelled(ctx: ReservationAccessContext) {
  await onReservationCancelledForTTLock({
    reservationId: ctx.reservationId,
    propertyId: ctx.propertyId,
    ownerId: ctx.ownerId,
  });
}
