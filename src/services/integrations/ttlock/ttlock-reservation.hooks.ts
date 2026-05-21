/**
 * Extension points for the future TTLock passcode flow.
 * No live TTLock code generation is performed here.
 */

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

/** Called when Airbnb/iCal confirms a reservation (hook placeholder). */
export async function onReservationConfirmedForTTLock(
  ctx: Pick<TTLockReservationAccessContext, "reservationId" | "propertyId" | "ownerId">,
): Promise<void> {
  void ctx;
  // Future: ensure integration + automation pre-checks.
}

/** Called after guest registration completes (hook placeholder). */
export async function onGuestRegistrationCompletedForTTLock(
  ctx: Pick<
    TTLockReservationAccessContext,
    "reservationId" | "propertyId" | "ownerId" | "guestRegistrationCompleted"
  >,
): Promise<void> {
  void ctx;
  // Future: trigger passcode generation when automation is enabled.
}

/** Called before persisting AccessCredential (hook placeholder). */
export async function beforeAccessCredentialPersist(
  ctx: TTLockReservationAccessContext,
): Promise<void> {
  void ctx;
  // Future: validate lock mapping + token health.
}
