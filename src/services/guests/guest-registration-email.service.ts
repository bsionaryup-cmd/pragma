import "server-only";

import { BookingPlatform, ReservationStatus } from "@prisma/client";
import { pragmaEmailFooterHtml, pragmaEmailHeaderHtml } from "@/lib/brand-email";
import { sendEmail } from "@/lib/email/send-email";
import { formatMoney } from "@/lib/format-currency";
import {
  GUEST_REGISTRATION_INVITE_SENDING_MARKER,
  isValidGuestInviteEmail,
  parseGuestRegistrationInviteLog,
  type GuestRegistrationInviteLogEntry,
} from "@/lib/guest-registration/guest-registration-invite-email-log";
import { formatDate } from "@/lib/helpers/date";
import { db } from "@/lib/db";
import { formatPropertyLabel } from "@/lib/property-display";
import {
  buildGuestRegistrationUrl,
  isGuestRegistrationEligibleStatus,
} from "@/services/guests/guest-registration.service";

export type SendGuestRegistrationInviteOptions = {
  force?: boolean;
  triggeredBy?: "auto" | "manual";
  userId?: string;
};

export type SendGuestRegistrationInviteResult = {
  ok: boolean;
  message: string;
  skipped?: boolean;
  providerId?: string;
};

function claimableInviteErrorFilter() {
  return {
    OR: [
      { guestRegistrationInviteError: null },
      {
        guestRegistrationInviteError: {
          not: GUEST_REGISTRATION_INVITE_SENDING_MARKER,
        },
      },
    ],
  };
}

async function claimInviteSend(
  reservationId: string,
  force: boolean,
): Promise<boolean> {
  if (force) {
    const claimed = await db.reservation.updateMany({
      where: {
        id: reservationId,
        ...claimableInviteErrorFilter(),
      },
      data: {
        guestRegistrationInviteSentAt: null,
        guestRegistrationInviteError: GUEST_REGISTRATION_INVITE_SENDING_MARKER,
      },
    });
    return claimed.count === 1;
  }

  const claimed = await db.reservation.updateMany({
    where: {
      id: reservationId,
      guestRegistrationInviteSentAt: null,
      ...claimableInviteErrorFilter(),
    },
    data: {
      guestRegistrationInviteError: GUEST_REGISTRATION_INVITE_SENDING_MARKER,
    },
  });
  return claimed.count === 1;
}

async function appendInviteLog(
  reservationId: string,
  entry: GuestRegistrationInviteLogEntry,
  fields: {
    sentAt: Date | null;
    error: string | null;
  },
) {
  const current = await db.reservation.findUnique({
    where: { id: reservationId },
    select: { guestRegistrationInviteLog: true },
  });
  const log = parseGuestRegistrationInviteLog(
    current?.guestRegistrationInviteLog,
  );
  log.push(entry);

  await db.reservation.update({
    where: { id: reservationId },
    data: {
      guestRegistrationInviteLog: log,
      guestRegistrationInviteSentAt: fields.sentAt,
      guestRegistrationInviteError: fields.error,
    },
  });
}

async function releaseInviteClaim(
  reservationId: string,
  error: string | null,
) {
  await db.reservation.updateMany({
    where: {
      id: reservationId,
      guestRegistrationInviteError: GUEST_REGISTRATION_INVITE_SENDING_MARKER,
    },
    data: {
      guestRegistrationInviteError: error,
    },
  });
}

function buildInviteEmailHtml(input: {
  guestName: string;
  propertyLabel: string;
  checkInLabel: string;
  checkOutLabel: string;
  registrationUrl: string;
  cleaningNote: string;
}): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:560px;margin:0 auto">
      ${pragmaEmailHeaderHtml()}
      <h1 style="font-size:20px;margin:0 0 12px">Tu reserva en ${input.propertyLabel}</h1>
      <p style="margin:0 0 12px;line-height:1.5">
        Hola ${input.guestName}, gracias por reservar con nosotros.
      </p>
      <p style="margin:0 0 12px;line-height:1.5">
        Estancia: <strong>${input.checkInLabel}</strong> →
        <strong>${input.checkOutLabel}</strong>
      </p>
      <p style="margin:0 0 16px;line-height:1.5">
        Para completar tu llegada, regístrate con el enlace seguro de PRAGMA (datos de huéspedes y acceso):
      </p>
      <p style="margin:0 0 20px">
        <a href="${input.registrationUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
          Completar registro de huéspedes
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all">
        ${input.registrationUrl}
      </p>
      ${input.cleaningNote}
      ${pragmaEmailFooterHtml()}
    </div>
  `;
}

export async function sendGuestRegistrationInviteEmail(input: {
  reservationId: string;
  registrationUrl: string;
}): Promise<SendGuestRegistrationInviteResult> {
  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    select: {
      guestEmail: true,
      guestFirstName: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
          cleaningFee: true,
          currency: true,
        },
      },
    },
  });

  if (!reservation) {
    return { ok: false, message: "Reserva no encontrada" };
  }

  const to = reservation.guestEmail?.trim().toLowerCase();
  if (!to || !isValidGuestInviteEmail(to)) {
    return { ok: false, message: "La reserva no tiene email de huésped válido" };
  }

  const guestName =
    reservation.guestFirstName?.trim() ||
    reservation.guestName.split(" ")[0] ||
    "Huésped";
  const propertyLabel = formatPropertyLabel(reservation.property);
  const cleaningFee = reservation.property.cleaningFee
    ? Number(reservation.property.cleaningFee)
    : 0;
  const cleaningNote =
    cleaningFee > 0
      ? `<p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.5">
           <strong>Tarifa de aseo (referencia):</strong>
           ${formatMoney(cleaningFee, reservation.property.currency)}.
           Este valor se muestra solo como aclaración en tu presupuesto; no se cobra automáticamente como gasto adicional.
         </p>`
      : "";

  const html = buildInviteEmailHtml({
    guestName,
    propertyLabel,
    checkInLabel: formatDate(reservation.checkIn),
    checkOutLabel: formatDate(reservation.checkOut),
    registrationUrl: input.registrationUrl,
    cleaningNote,
  });

  return sendEmail({
    to,
    subject: `Registro de huéspedes — ${propertyLabel}`,
    html,
    text: `Hola ${guestName}. Completa tu registro: ${input.registrationUrl}`,
  }).then((result) => ({
    ok: result.ok,
    message: result.message,
    providerId: result.id,
  }));
}

/**
 * Envía el correo de bienvenida / invite de Guest Registration.
 * Auto: solo Direct, una vez (idempotente). Manual: `force: true`.
 */
export async function sendGuestRegistrationEmailForReservation(
  reservationId: string,
  options: SendGuestRegistrationInviteOptions = {},
): Promise<SendGuestRegistrationInviteResult> {
  const force = options.force === true;
  const triggeredBy = options.triggeredBy ?? (force ? "manual" : "auto");

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      platform: true,
      status: true,
      guestEmail: true,
      holdExpiresAt: true,
      guestRegistrationInviteSentAt: true,
      guestRegistrationInviteError: true,
    },
  });

  if (!reservation) {
    return { ok: false, message: "Reserva no encontrada" };
  }

  if (!force) {
    if (reservation.platform !== BookingPlatform.DIRECT) {
      return {
        ok: true,
        skipped: true,
        message: "Correo de bienvenida solo para reservas directas",
      };
    }

    if (
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.BLOCKED
    ) {
      return {
        ok: true,
        skipped: true,
        message: "Reserva cancelada o bloqueada; no se envía bienvenida",
      };
    }

    if (!isGuestRegistrationEligibleStatus(reservation.status)) {
      return {
        ok: true,
        skipped: true,
        message: "Estado de reserva no elegible para bienvenida",
      };
    }

    if (reservation.guestRegistrationInviteSentAt) {
      return {
        ok: true,
        skipped: true,
        message: "Correo de bienvenida ya enviado",
      };
    }

    if (reservation.holdExpiresAt) {
      return {
        ok: true,
        skipped: true,
        message: "Reserva en hold de pago; bienvenida diferida",
      };
    }
  }

  const to = reservation.guestEmail?.trim().toLowerCase() ?? "";
  if (!isValidGuestInviteEmail(to)) {
    return {
      ok: false,
      message: "La reserva no tiene email de huésped válido",
    };
  }

  const claimed = await claimInviteSend(reservationId, force);
  if (!claimed) {
    const latest = await db.reservation.findUnique({
      where: { id: reservationId },
      select: {
        guestRegistrationInviteSentAt: true,
        guestRegistrationInviteError: true,
      },
    });
    if (
      latest?.guestRegistrationInviteError ===
      GUEST_REGISTRATION_INVITE_SENDING_MARKER
    ) {
      return {
        ok: true,
        skipped: true,
        message: "Envío de bienvenida en curso",
      };
    }
    if (latest?.guestRegistrationInviteSentAt && !force) {
      return {
        ok: true,
        skipped: true,
        message: "Correo de bienvenida ya enviado",
      };
    }
    return {
      ok: true,
      skipped: true,
      message: "No se pudo reclamar el envío de bienvenida",
    };
  }

  try {
    let tokenRow = await db.guestRegistrationToken.findFirst({
      where: { reservationId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { token: true },
    });

    // Reenvío manual: permitir último token aunque ya no esté ACTIVE (p. ej. GR completado).
    if (!tokenRow?.token && force) {
      tokenRow = await db.guestRegistrationToken.findFirst({
        where: { reservationId },
        orderBy: { createdAt: "desc" },
        select: { token: true },
      });
    }

    if (!tokenRow?.token) {
      const entry: GuestRegistrationInviteLogEntry = {
        at: new Date().toISOString(),
        status: "failed",
        recipient: to,
        error: "No hay link de registro activo",
        triggeredBy,
        userId: options.userId,
      };
      await appendInviteLog(reservationId, entry, {
        sentAt: null,
        error: entry.error!,
      });
      return { ok: false, message: entry.error! };
    }

    const result = await sendGuestRegistrationInviteEmail({
      reservationId,
      registrationUrl: buildGuestRegistrationUrl(tokenRow.token),
    });

    if (!result.ok) {
      const entry: GuestRegistrationInviteLogEntry = {
        at: new Date().toISOString(),
        status: "failed",
        recipient: to,
        error: result.message,
        triggeredBy,
        userId: options.userId,
      };
      await appendInviteLog(reservationId, entry, {
        sentAt: null,
        error: result.message,
      });
      return { ok: false, message: result.message };
    }

    const entry: GuestRegistrationInviteLogEntry = {
      at: new Date().toISOString(),
      status: "success",
      recipient: to,
      providerId: result.providerId,
      triggeredBy,
      userId: options.userId,
    };
    await appendInviteLog(reservationId, entry, {
      sentAt: new Date(),
      error: null,
    });

    return {
      ok: true,
      message: "Correo de bienvenida enviado",
      providerId: result.providerId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al enviar bienvenida";
    console.error("[guest-registration-invite]", reservationId, error);
    await releaseInviteClaim(reservationId, message).catch(() => undefined);
    return { ok: false, message };
  }
}
