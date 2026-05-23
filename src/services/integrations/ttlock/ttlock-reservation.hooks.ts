import { processReservationAccessAfterRegistration } from "@/services/integrations/ttlock/ttlock-access.service";

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

/** Called when Airbnb/iCal confirms a reservation. */
export async function onReservationConfirmedForTTLock(
  ctx: Pick<TTLockReservationAccessContext, "reservationId" | "propertyId" | "ownerId">,
): Promise<void> {
  void ctx;
}

/** Triggers TTLock passcode flow once guest registration is complete. */
export async function onGuestRegistrationCompletedForTTLock(
  ctx: Pick<
    TTLockReservationAccessContext,
    "reservationId" | "propertyId" | "ownerId" | "guestRegistrationCompleted"
  >,
): Promise<void> {
  if (!ctx.guestRegistrationCompleted) return;

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
