import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { formatDate } from "@/lib/helpers/date";
import { getGuestDocumentTypeLabel } from "@/lib/guest-document-types";
import { parsePropertyNotificationEmails } from "@/lib/property-notification-emails";
import { formatPropertyLabel } from "@/lib/property-display";
import { db } from "@/lib/db";
import {
  buildGuestRegistrationAdminEmailHtml,
  buildGuestRegistrationAdminEmailSubject,
  type GuestRegistrationAdminEmailPayload,
} from "@/services/guests/guest-registration-admin-notification.content";

export type { GuestRegistrationAdminEmailPayload } from "@/services/guests/guest-registration-admin-notification.content";
export {
  buildGuestRegistrationAdminEmailHtml,
  buildGuestRegistrationAdminEmailSubject,
} from "@/services/guests/guest-registration-admin-notification.content";

async function loadAdminNotificationContext(reservationId: string) {
  return db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      reservationCode: true,
      guestRegistrationCompletedAt: true,
      guestRegistrationAdminNotifiedAt: true,
      checkIn: true,
      checkOut: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
          notificationEmails: true,
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
          isReservationOwner: true,
        },
      },
    },
  });
}

/**
 * Sends admin notification after guest registration is complete.
 * Fire-and-forget safe: never throws; failures are stored on the reservation.
 */
export async function notifyAdminGuestRegistrationCompleted(
  reservationId: string,
): Promise<void> {
  try {
    const reservation = await loadAdminNotificationContext(reservationId);
    if (!reservation?.guestRegistrationCompletedAt) return;
    if (reservation.guestRegistrationAdminNotifiedAt) return;

    const recipients = parsePropertyNotificationEmails(
      reservation.property.notificationEmails,
    );
    if (recipients.length === 0) return;

    const owner =
      reservation.guests.find((guest) => guest.isReservationOwner) ??
      reservation.guests[0];
    if (!owner) {
      await recordAdminNotificationError(
        reservationId,
        "No hay huésped titular registrado para notificar.",
      );
      return;
    }

    const propertyLabel = formatPropertyLabel(reservation.property);
    const payload: GuestRegistrationAdminEmailPayload = {
      reservationCode: reservation.reservationCode,
      propertyLabel,
      checkIn: formatDate(reservation.checkIn),
      checkOut: formatDate(reservation.checkOut),
      primaryGuestName: owner.fullName,
      documentType: owner.documentType,
      documentNumber: owner.documentNumber,
      email: owner.email,
      phone: owner.phone,
      guestCount: reservation.guests.length,
    };

    const subject = buildGuestRegistrationAdminEmailSubject(
      propertyLabel,
      reservation.reservationCode,
    );
    const html = buildGuestRegistrationAdminEmailHtml(payload);
    const text = [
      `Registro completado — ${propertyLabel}`,
      reservation.reservationCode
        ? `Reserva: ${reservation.reservationCode}`
        : null,
      `Check-in: ${payload.checkIn} · Check-out: ${payload.checkOut}`,
      `Huésped principal: ${owner.fullName}`,
      `Documento: ${getGuestDocumentTypeLabel(owner.documentType)} ${owner.documentNumber}`,
      `Teléfono: ${owner.phone ?? "—"}`,
      `Correo: ${owner.email ?? "—"}`,
      `Huéspedes registrados: ${reservation.guests.length}`,
    ]
      .filter(Boolean)
      .join("\n");

    const failures: string[] = [];
    for (const to of recipients) {
      const result = await sendEmail({ to, subject, html, text });
      if (!result.ok) {
        failures.push(`${to}: ${result.message}`);
      }
    }

    if (failures.length > 0) {
      await recordAdminNotificationError(reservationId, failures.join("; "));
      return;
    }

    const marked = await db.reservation.updateMany({
      where: {
        id: reservationId,
        guestRegistrationAdminNotifiedAt: null,
      },
      data: {
        guestRegistrationAdminNotifiedAt: new Date(),
        guestRegistrationAdminNotificationError: null,
      },
    });

    if (marked.count === 0) {
      console.info(
        "[guest-registration-admin-notify] Already notified",
        reservationId,
      );
    }
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
  }
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
