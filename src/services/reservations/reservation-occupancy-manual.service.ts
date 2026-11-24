import "server-only";

import {
  GuestRegistrationStatus,
  ReservationGuestStatus,
  StayPortalTokenStatus,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { getPublicAppUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { getGuestRegistrationMaxCapacity } from "@/lib/guest-registration/guest-registration-capacity";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";
import { sendGuestRegistrationEmailForReservation } from "@/services/guests/guest-registration-email.service";
import { notifyAdminGuestRegistrationPendingUpdate } from "@/services/guests/guest-registration-pending-update-notify.service";

function buildGuestRegistrationUrl(token: string): string {
  return `${getPublicAppUrl()}/guest-registration/${encodeURIComponent(token)}`;
}

export type ReservationOccupancyInput = {
  adults: number;
  children: number;
  infants: number;
};

export type UpdateReservationOccupancyResult = {
  reservationId: string;
  adults: number;
  children: number;
  infants: number;
  expectedGuests: number;
  registeredGuests: number;
  pendingGuests: number;
  registrationReopened: boolean;
  guestRegistrationUrl: string | null;
  stayBlocked: boolean;
};

export class ReservationOccupancyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationOccupancyError";
  }
}

async function countRegisteredGuests(reservationId: string): Promise<number> {
  return db.reservationGuest.count({
    where: {
      reservationId,
      status: { not: ReservationGuestStatus.PENDING_REGISTRATION },
    },
  });
}

/**
 * After occupancy grows past registered guests: clear GR completion, ensure ACTIVE
 * token, revoke Stay portal, invite + ops notify. Existing ReservationGuest rows kept.
 */
export async function syncGuestRegistrationAfterOccupancyChange(
  reservationId: string,
  options?: { previousOccupancy?: ReservationOccupancyInput },
): Promise<{
  registrationReopened: boolean;
  guestRegistrationUrl: string | null;
  stayBlocked: boolean;
  expectedGuests: number;
  registeredGuests: number;
  pendingGuests: number;
}> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      platform: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
      guestEmail: true,
      guestName: true,
      property: {
        select: {
          maxGuests: true,
          name: true,
          unitNumber: true,
          organizationId: true,
          notificationEmails: true,
          operationalContacts: true,
          guestRegistrationContactKey: true,
        },
      },
    },
  });

  if (!reservation) {
    throw new ReservationOccupancyError("Reserva no encontrada");
  }

  const registeredGuests = await countRegisteredGuests(reservationId);
  const expectedGuests = getGuestRegistrationMaxCapacity({
    platform: reservation.platform,
    adults: reservation.adults,
    children: reservation.children,
    infants: reservation.infants,
    propertyMaxGuests: reservation.property.maxGuests,
    guestRegistrationCompletedAt: null,
    registeredCount: registeredGuests > 0 ? registeredGuests : undefined,
  });
  const pendingGuests = Math.max(0, expectedGuests - registeredGuests);

  if (pendingGuests <= 0) {
    return {
      registrationReopened: false,
      guestRegistrationUrl: null,
      stayBlocked: false,
      expectedGuests,
      registeredGuests,
      pendingGuests: 0,
    };
  }

  const wasComplete = Boolean(reservation.guestRegistrationCompletedAt);
  const occupancyIncreased =
    options?.previousOccupancy != null
      ? reservation.adults + reservation.children >
          options.previousOccupancy.adults + options.previousOccupancy.children ||
        reservation.infants > options.previousOccupancy.infants
      : true;

  // Reopen when guests are missing (always if was complete; or if still open but capacity grew).
  const shouldReopen = wasComplete || occupancyIncreased;

  if (!shouldReopen) {
    const active = await db.guestRegistrationToken.findFirst({
      where: {
        reservationId,
        status: GuestRegistrationStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      registrationReopened: false,
      guestRegistrationUrl: active
        ? buildGuestRegistrationUrl(active.token)
        : null,
      stayBlocked: !wasComplete,
      expectedGuests,
      registeredGuests,
      pendingGuests,
    };
  }

  const token = randomBytes(24).toString("hex");

  await db.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        guestRegistrationCompletedAt: null,
        guestRegistrationToken: token,
        // Reset completion-comms markers so a future complete can notify again.
        guestRegistrationAdminNotifiedAt: null,
        guestRegistrationAdminNotificationError: null,
      },
    });

    await tx.guestRegistrationToken.updateMany({
      where: {
        reservationId,
        status: GuestRegistrationStatus.ACTIVE,
      },
      data: {
        status: GuestRegistrationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await tx.guestRegistrationToken.create({
      data: {
        reservationId,
        token,
        expiresAt: null,
        createdBySystem: true,
      },
    });

    await tx.stayPortalToken.updateMany({
      where: {
        reservationId,
        status: StayPortalTokenStatus.ACTIVE,
      },
      data: { status: StayPortalTokenStatus.REVOKED },
    });
  });

  const guestRegistrationUrl = buildGuestRegistrationUrl(token);

  await sendGuestRegistrationEmailForReservation(reservationId, {
    force: true,
    triggeredBy: "manual",
  }).catch((error) => {
    console.warn(
      "[occupancy] guest registration invite resend failed",
      reservationId,
      error,
    );
  });

  await notifyAdminGuestRegistrationPendingUpdate({
    reservationId,
    expectedGuests,
    registeredGuests,
    pendingGuests,
    guestRegistrationUrl,
  }).catch((error) => {
    console.warn(
      "[occupancy] ops pending-update notify failed",
      reservationId,
      error,
    );
  });

  return {
    registrationReopened: true,
    guestRegistrationUrl,
    stayBlocked: true,
    expectedGuests,
    registeredGuests,
    pendingGuests,
  };
}

export async function updateReservationOccupancyManual(
  reservationId: string,
  input: ReservationOccupancyInput,
): Promise<UpdateReservationOccupancyResult> {
  const [scope, tenantCtx] = await Promise.all([
    requireTenantDataScope(),
    requireTenantContext(),
  ]);
  await assertReservationInScope(scope, reservationId);

  const adults = Math.max(0, Math.floor(input.adults));
  const children = Math.max(0, Math.floor(input.children));
  const infants = Math.max(0, Math.floor(input.infants));

  if (adults < 1) {
    throw new ReservationOccupancyError("Mínimo 1 adulto");
  }
  if (adults + children + infants < 1) {
    throw new ReservationOccupancyError("Debe haber al menos un huésped");
  }

  const existing = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      platform: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
      property: { select: { maxGuests: true } },
    },
  });

  if (!existing) {
    throw new ReservationOccupancyError("Reserva no encontrada");
  }

  const guestTotal = adults + children + infants;
  if (guestTotal > existing.property.maxGuests) {
    throw new ReservationOccupancyError(
      `Máximo ${existing.property.maxGuests} huésped${existing.property.maxGuests === 1 ? "" : "es"} (capacidad de la propiedad)`,
    );
  }

  const registeredGuests = await countRegisteredGuests(reservationId);
  const nextExpected = getGuestRegistrationMaxCapacity({
    platform: existing.platform,
    adults,
    children,
    infants,
    propertyMaxGuests: existing.property.maxGuests,
    registeredCount: registeredGuests > 0 ? registeredGuests : undefined,
  });

  if (registeredGuests > nextExpected) {
    throw new ReservationOccupancyError(
      `Ya hay ${registeredGuests} huésped${registeredGuests === 1 ? "" : "es"} registrado${registeredGuests === 1 ? "" : "s"}. No puedes bajar la ocupación de registro por debajo de ese número (${nextExpected} adultos+niños).`,
    );
  }

  const previous = {
    adults: existing.adults,
    children: existing.children,
    infants: existing.infants,
  };

  const unchanged =
    previous.adults === adults &&
    previous.children === children &&
    previous.infants === infants;

  if (!unchanged) {
    await db.reservation.update({
      where: { id: reservationId },
      data: { adults, children, infants },
    });
  }

  const sync = await syncGuestRegistrationAfterOccupancyChange(reservationId, {
    previousOccupancy: previous,
  });

  await writePlatformAuditLog({
    platformUserId: tenantCtx.userId,
    ownerEmail: tenantCtx.email,
    action: "reservation_occupancy_manual_update",
    targetTenantId: scope.organizationId,
    metadata: {
      reservationId,
      platform: existing.platform,
      previous,
      next: { adults, children, infants },
      expectedGuests: sync.expectedGuests,
      registeredGuests: sync.registeredGuests,
      pendingGuests: sync.pendingGuests,
      registrationReopened: sync.registrationReopened,
      stayBlocked: sync.stayBlocked,
    },
  });

  return {
    reservationId,
    adults,
    children,
    infants,
    expectedGuests: sync.expectedGuests,
    registeredGuests: sync.registeredGuests,
    pendingGuests: sync.pendingGuests,
    registrationReopened: sync.registrationReopened,
    guestRegistrationUrl: sync.guestRegistrationUrl,
    stayBlocked: sync.stayBlocked,
  };
}
