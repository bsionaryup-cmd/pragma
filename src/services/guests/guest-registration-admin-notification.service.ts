import "server-only";

import { formatAccessCode } from "@/lib/access-code";
import { sendEmail } from "@/lib/email/send-email";
import { formatDate, formatDateTime } from "@/lib/helpers/date";
import {
  GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER,
  getLatestGuestRegistrationAdminNotificationLogEntry,
  parseGuestRegistrationAdminNotificationLog,
  type GuestRegistrationAdminNotificationAttemptStatus,
  type GuestRegistrationAdminNotificationLogEntry,
} from "@/lib/guest-registration/guest-registration-admin-notification-log";
import {
  resolveGuestRegistrationAdminRecipients,
} from "@/lib/operational-contacts";
import { formatPropertyLabel } from "@/lib/property-display";
import { db } from "@/lib/db";
import {
  buildGuestRegistrationAdminEmailHtml,
  buildGuestRegistrationAdminEmailSubject,
  buildGuestRegistrationAdminEmailText,
  type GuestRegistrationAdminEmailPayload,
} from "@/services/guests/guest-registration-admin-notification.content";
import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";

export type { GuestRegistrationAdminEmailPayload } from "@/services/guests/guest-registration-admin-notification.content";
export {
  buildGuestRegistrationAdminEmailHtml,
  buildGuestRegistrationAdminEmailSubject,
  buildGuestRegistrationAdminEmailText,
} from "@/services/guests/guest-registration-admin-notification.content";

export type NotifyAdminGuestRegistrationOptions = {
  force?: boolean;
  triggeredBy?: "auto" | "manual";
  userId?: string;
};

export type NotifyAdminGuestRegistrationResult = {
  ok: boolean;
  message: string;
  skipped?: boolean;
};

async function loadAdminNotificationContext(reservationId: string) {
  return db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      reservationCode: true,
      guestRegistrationCompletedAt: true,
      guestRegistrationAdminNotifiedAt: true,
      guestRegistrationAdminNotificationError: true,
      guestRegistrationAdminNotificationLog: true,
      checkIn: true,
      checkOut: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
          notificationEmails: true,
          operationalContacts: true,
          guestRegistrationContactKey: true,
        },
      },
      guests: {
        orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
        select: {
          fullName: true,
          documentType: true,
          documentNumber: true,
          email: true,
          phone: true,
          nationality: true,
          dateOfBirth: true,
          isReservationOwner: true,
        },
      },
    },
  });
}

function formatGuestBirthDate(value: Date | null): string | null {
  return value ? formatDate(value) : null;
}

function resolveAdminRecipients(property: {
  notificationEmails: unknown;
  operationalContacts: unknown;
  guestRegistrationContactKey: string | null;
}) {
  return resolveGuestRegistrationAdminRecipients(property);
}

async function buildEmailPayload(
  reservation: NonNullable<Awaited<ReturnType<typeof loadAdminNotificationContext>>>,
): Promise<GuestRegistrationAdminEmailPayload | null> {
  const owner =
    reservation.guests.find((guest) => guest.isReservationOwner) ??
    reservation.guests[0];
  if (!owner) return null;

  const companions = reservation.guests
    .filter((guest) => !guest.isReservationOwner)
    .map((guest) => ({
      fullName: guest.fullName,
      documentType: guest.documentType,
      documentNumber: guest.documentNumber,
      nationality: guest.nationality,
      dateOfBirth: formatGuestBirthDate(guest.dateOfBirth),
    }));

  const credential = await db.accessCredential.findFirst({
    where: {
      reservationId: reservation.id,
      ttlockCodeId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      codeEncrypted: true,
      validFrom: true,
      validTo: true,
    },
  });

  const accessCode = credential
    ? formatAccessCode(decryptTTLockSecret(credential.codeEncrypted))
    : null;

  return {
    reservationCode: reservation.reservationCode,
    propertyLabel: formatPropertyLabel(reservation.property),
    checkIn: formatDate(reservation.checkIn),
    checkOut: formatDate(reservation.checkOut),
    guestCount: reservation.guests.length,
    primaryGuest: {
      fullName: owner.fullName,
      documentType: owner.documentType,
      documentNumber: owner.documentNumber,
      nationality: owner.nationality,
      dateOfBirth: formatGuestBirthDate(owner.dateOfBirth),
      email: owner.email,
      phone: owner.phone,
    },
    companions,
    accessCode,
    accessValidFrom: credential?.validFrom
      ? formatDateTime(credential.validFrom)
      : null,
    accessValidTo: credential?.validTo
      ? formatDateTime(credential.validTo)
      : null,
  };
}

function claimableAdminNotificationErrorFilter() {
  return {
    OR: [
      { guestRegistrationAdminNotificationError: null },
      {
        guestRegistrationAdminNotificationError: {
          not: GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER,
        },
      },
    ],
  };
}

async function claimAdminNotificationSend(
  reservationId: string,
  force: boolean,
): Promise<boolean> {
  if (force) {
    const claimed = await db.reservation.updateMany({
      where: {
        id: reservationId,
        guestRegistrationCompletedAt: { not: null },
        ...claimableAdminNotificationErrorFilter(),
      },
      data: {
        guestRegistrationAdminNotifiedAt: null,
        guestRegistrationAdminNotificationError:
          GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER,
      },
    });
    return claimed.count === 1;
  }

  const claimed = await db.reservation.updateMany({
    where: {
      id: reservationId,
      guestRegistrationCompletedAt: { not: null },
      guestRegistrationAdminNotifiedAt: null,
      ...claimableAdminNotificationErrorFilter(),
    },
    data: {
      guestRegistrationAdminNotificationError:
        GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER,
    },
  });
  return claimed.count === 1;
}

async function appendNotificationLog(
  reservationId: string,
  entry: GuestRegistrationAdminNotificationLogEntry,
  input: {
    notifiedAt: Date | null;
    error: string | null;
  },
): Promise<void> {
  const current = await db.reservation.findUnique({
    where: { id: reservationId },
    select: { guestRegistrationAdminNotificationLog: true },
  });
  const log = parseGuestRegistrationAdminNotificationLog(
    current?.guestRegistrationAdminNotificationLog,
  );

  await db.reservation.update({
    where: { id: reservationId },
    data: {
      guestRegistrationAdminNotifiedAt: input.notifiedAt,
      guestRegistrationAdminNotificationError: input.error,
      guestRegistrationAdminNotificationLog: [...log, entry],
    },
  });
}

async function recordAdminNotificationError(
  reservationId: string,
  errorMessage: string,
): Promise<void> {
  const clipped = errorMessage.trim().slice(0, 2000);
  await db.reservation.updateMany({
    where: {
      id: reservationId,
      guestRegistrationAdminNotifiedAt: null,
    },
    data: {
      guestRegistrationAdminNotificationError: clipped || "Error al enviar correo",
    },
  });
}

/**
 * Sends admin notification after guest registration is complete.
 * Fire-and-forget safe: never throws; failures are stored on the reservation.
 */
export async function notifyAdminGuestRegistrationCompleted(
  reservationId: string,
  options: NotifyAdminGuestRegistrationOptions = {},
): Promise<NotifyAdminGuestRegistrationResult> {
  const triggeredBy = options.triggeredBy ?? "auto";
  const force = options.force === true;

  try {
    const reservation = await loadAdminNotificationContext(reservationId);
    if (!reservation?.guestRegistrationCompletedAt) {
      return { ok: false, message: "El registro aún no está completado", skipped: true };
    }

    if (
      !force &&
      reservation.guestRegistrationAdminNotifiedAt &&
      reservation.guestRegistrationAdminNotificationError !==
        GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER
    ) {
      return { ok: true, message: "Ya se notificó a administración", skipped: true };
    }

    const claimed = await claimAdminNotificationSend(reservationId, force);
    if (!claimed) {
      const latest = await loadAdminNotificationContext(reservationId);
      if (latest?.guestRegistrationAdminNotifiedAt && !force) {
        return { ok: true, message: "Ya se notificó a administración", skipped: true };
      }
      if (
        latest?.guestRegistrationAdminNotificationError ===
        GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER
      ) {
        return {
          ok: false,
          message: "Ya hay un envío en curso para esta reserva",
          skipped: true,
        };
      }
      return { ok: false, message: "No se pudo iniciar el envío", skipped: true };
    }

    const recipientResolution = resolveAdminRecipients(reservation.property);
    const recipients = recipientResolution.recipients;
    if (recipients.length === 0) {
      const entry: GuestRegistrationAdminNotificationLogEntry = {
        at: new Date().toISOString(),
        status: "failed",
        recipients: [],
        error:
          "Configura un Contacto Operativo (con email activo) para Guest Registration o notificationEmails en la propiedad.",
        triggeredBy,
        userId: options.userId,
      };
      await appendNotificationLog(reservationId, entry, {
        notifiedAt: null,
        error: entry.error ?? "Error al enviar correo",
      });
      return { ok: false, message: entry.error ?? "Sin destinatarios configurados" };
    }

    const payload = await buildEmailPayload(reservation);
    if (!payload) {
      const entry: GuestRegistrationAdminNotificationLogEntry = {
        at: new Date().toISOString(),
        status: "failed",
        recipients,
        error: "No hay huésped titular registrado para notificar.",
        triggeredBy,
        userId: options.userId,
      };
      await appendNotificationLog(reservationId, entry, {
        notifiedAt: null,
        error: entry.error ?? "No hay huésped titular registrado para notificar.",
      });
      return {
        ok: false,
        message: entry.error ?? "No hay huésped titular registrado para notificar.",
      };
    }

    const subject = buildGuestRegistrationAdminEmailSubject(
      payload.propertyLabel,
      payload.primaryGuest.fullName,
      reservation.reservationCode,
    );
    const html = buildGuestRegistrationAdminEmailHtml(payload);
    const text = buildGuestRegistrationAdminEmailText(payload);

    const failures: string[] = [];
    const providerIds: Record<string, string> = {};
    for (const to of recipients) {
      const result = await sendEmail({ to, subject, html, text });
      if (!result.ok) {
        failures.push(`${to}: ${result.message}`);
        continue;
      }
      if (result.id) providerIds[to] = result.id;
    }

    const successCount = recipients.length - failures.length;
    let status: GuestRegistrationAdminNotificationAttemptStatus = "success";
    if (successCount === 0) status = "failed";
    else if (failures.length > 0) status = "partial";

    const entry: GuestRegistrationAdminNotificationLogEntry = {
      at: new Date().toISOString(),
      status,
      recipients,
      providerIds: Object.keys(providerIds).length > 0 ? providerIds : undefined,
      error: failures.length > 0 ? failures.join("; ") : undefined,
      triggeredBy,
      userId: options.userId,
      source: recipientResolution.source,
      selectedContactKey: recipientResolution.selectedContact?.key,
    };

    if (status === "success") {
      await appendNotificationLog(reservationId, entry, {
        notifiedAt: new Date(),
        error: null,
      });
      return { ok: true, message: "Correo enviado a administración" };
    }

    await appendNotificationLog(reservationId, entry, {
      notifiedAt: null,
      error: entry.error ?? "Error al enviar correo",
    });
    return {
      ok: false,
      message: entry.error ?? "No se pudo enviar el correo a administración",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al notificar";
    console.error("[guest-registration-admin-notify]", reservationId, error);
    await recordAdminNotificationError(reservationId, message).catch((err) => {
      console.error(
        "[guest-registration-admin-notify] Failed to persist error",
        reservationId,
        err,
      );
    });
    return { ok: false, message };
  }
}

export async function resendAdminGuestRegistrationNotification(
  reservationId: string,
  userId: string,
): Promise<NotifyAdminGuestRegistrationResult> {
  return notifyAdminGuestRegistrationCompleted(reservationId, {
    force: true,
    triggeredBy: "manual",
    userId,
  });
}

export function buildGuestRegistrationAdminNotificationStatus(input: {
  guestRegistrationCompletedAt: Date | null;
  guestRegistrationAdminNotifiedAt: Date | null;
  guestRegistrationAdminNotificationError: string | null;
  guestRegistrationAdminNotificationLog: unknown;
  notificationEmails: unknown;
  operationalContacts?: unknown;
  guestRegistrationContactKey?: string | null;
}) {
  const recipientResolution = resolveAdminRecipients({
    notificationEmails: input.notificationEmails,
    operationalContacts: input.operationalContacts ?? [],
    guestRegistrationContactKey: input.guestRegistrationContactKey ?? null,
  });
  const recipients = recipientResolution.recipients;
  const log = parseGuestRegistrationAdminNotificationLog(
    input.guestRegistrationAdminNotificationLog,
  );
  const latest = getLatestGuestRegistrationAdminNotificationLogEntry(
    input.guestRegistrationAdminNotificationLog,
  );
  const visibleError =
    input.guestRegistrationAdminNotificationError ===
    GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER
      ? null
      : input.guestRegistrationAdminNotificationError;

  return {
    completed: Boolean(input.guestRegistrationCompletedAt),
    notifiedAt: input.guestRegistrationAdminNotifiedAt?.toISOString() ?? null,
    error: visibleError,
    recipients,
    recipientSource: recipientResolution.source,
    selectedContact: recipientResolution.selectedContact,
    latestAttempt: latest,
    attemptCount: log.length,
    log,
  };
}
