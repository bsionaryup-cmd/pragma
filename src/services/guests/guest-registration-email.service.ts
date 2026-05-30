import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { formatMoney } from "@/lib/format-currency";
import { formatDate } from "@/lib/helpers/date";
import { db } from "@/lib/db";
import { buildGuestRegistrationUrl } from "@/services/guests/guest-registration.service";
import { formatPropertyLabel } from "@/lib/property-display";

export async function sendGuestRegistrationInviteEmail(input: {
  reservationId: string;
  registrationUrl: string;
}): Promise<{ ok: boolean; message: string }> {
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

  const to = reservation.guestEmail?.trim();
  if (!to) {
    return { ok: false, message: "La reserva no tiene email de huésped" };
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

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:560px">
      <h1 style="font-size:20px;margin:0 0 12px">Tu reserva en ${propertyLabel}</h1>
      <p style="margin:0 0 12px;line-height:1.5">
        Hola ${guestName}, gracias por reservar con nosotros.
      </p>
      <p style="margin:0 0 12px;line-height:1.5">
        Estancia: <strong>${formatDate(reservation.checkIn)}</strong> →
        <strong>${formatDate(reservation.checkOut)}</strong>
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
      ${cleaningNote}
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
        PRAGMA · Property Management
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Registro de huéspedes — ${propertyLabel}`,
    html,
    text: `Hola ${guestName}. Completa tu registro: ${input.registrationUrl}`,
  });
}

export async function sendGuestRegistrationEmailForReservation(
  reservationId: string,
): Promise<{ ok: boolean; message: string }> {
  const active = await db.guestRegistrationToken.findFirst({
    where: { reservationId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });

  if (!active?.token) {
    return { ok: false, message: "No hay link de registro activo" };
  }

  return sendGuestRegistrationInviteEmail({
    reservationId,
    registrationUrl: buildGuestRegistrationUrl(active.token),
  });
}
