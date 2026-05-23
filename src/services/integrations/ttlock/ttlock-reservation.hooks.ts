import {
  revokeAccessCodeForReservation,
  syncAccessCodeDatesForReservation,
  tryGenerateAccessCodeForReservation,
} from "@/services/integrations/ttlock/ttlock-access.service";

export type TTLockReservationAccessContext = {
  reservationId: string;
  propertyId: string;
  ownerId: string;
  guestRegistrationCompleted: boolean;
  checkIn: Date;
  checkOut: Date;
};

export type TTLockAccessPipelineStep =
  | "reservation_confirmed"
  | "guest_registration_completed"
  | "property_lock_mapped"
  | "ttlock_passcode_generation"
  | "access_credential_persisted"
  | "access_code_delivered";

export const TTLOCK_ACCESS_PIPELINE: TTLockAccessPipelineStep[] = [
  "reservation_confirmed",
  "guest_registration_completed",
  "property_lock_mapped",
  "ttlock_passcode_generation",
  "access_credential_persisted",
  "access_code_delivered",
];

/** booking.confirmed — prepare access; generate only if registration already complete. */
export async function onReservationConfirmedForTTLock(
  ctx: Pick<TTLockReservationAccessContext, "reservationId" | "propertyId" | "ownerId">,
): Promise<void> {
  await tryGenerateAccessCodeForReservation(ctx.reservationId);
}

/** booking.modified — sync code validity when dates change. */
export async function onReservationModifiedForTTLock(
  ctx: Pick<
    TTLockReservationAccessContext,
    | "reservationId"
    | "propertyId"
    | "ownerId"
    | "checkIn"
    | "checkOut"
    | "guestRegistrationCompleted"
  >,
): Promise<void> {
  if (!ctx.guestRegistrationCompleted) return;
  await syncAccessCodeDatesForReservation(ctx.reservationId);
}

/** booking.checked_out — revoke active code (idempotent). */
export async function onReservationCheckedOutForTTLock(
  ctx: Pick<TTLockReservationAccessContext, "reservationId" | "propertyId" | "ownerId">,
): Promise<void> {
  await revokeAccessCodeForReservation(ctx.reservationId);
}

/** booking.cancelled — revoke/delete code (idempotent). */
export async function onReservationCancelledForTTLock(
  ctx: Pick<TTLockReservationAccessContext, "reservationId" | "propertyId" | "ownerId">,
): Promise<void> {
  await revokeAccessCodeForReservation(ctx.reservationId);
}

/** Triggers TTLock passcode flow once guest registration is complete. */
export async function onGuestRegistrationCompletedForTTLock(
  ctx: Pick<
    TTLockReservationAccessContext,
    "reservationId" | "propertyId" | "ownerId" | "guestRegistrationCompleted"
  >,
): Promise<void> {
  if (!ctx.guestRegistrationCompleted) return;

  const { processReservationAccessAfterRegistration } = await import(
    "@/services/integrations/ttlock/ttlock-access.service"
  );
  await processReservationAccessAfterRegistration({
    reservationId: ctx.reservationId,
    propertyId: ctx.propertyId,
    ownerId: ctx.ownerId,
  });
}

/** Validates lock mapping + token health before persisting credentials. */
export async function beforeAccessCredentialPersist(
  ctx: TTLockReservationAccessContext,
): Promise<void> {
  void ctx;
}
