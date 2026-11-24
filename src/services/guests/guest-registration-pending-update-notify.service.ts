import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { formatPropertyLabel } from "@/lib/property-display";
import { resolveGuestRegistrationAdminRecipients } from "@/lib/operational-contacts";
import { db } from "@/lib/db";

export type NotifyPendingUpdateInput = {
  reservationId: string;
  expectedGuests: number;
  registeredGuests: number;
  pendingGuests: number;
  guestRegistrationUrl: string;
};

/**
 * Notifies operational contact that Guest Registration was reopened after a
 * manual occupancy increase (pending guests remain).
 */
export async function notifyAdminGuestRegistrationPendingUpdate(
  input: NotifyPendingUpdateInput,
): Promise<{ ok: boolean; message: string; skipped?: boolean }> {
  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    select: {
      guestName: true,
      reservationCode: true,
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
    },
  });

  if (!reservation) {
    return { ok: false, message: "Reserva no encontrada" };
  }

  const resolution = resolveGuestRegistrationAdminRecipients({
    notificationEmails: reservation.property.notificationEmails,
    operationalContacts: reservation.property.operationalContacts,
    guestRegistrationContactKey:
      reservation.property.guestRegistrationContactKey,
  });
  const recipients = resolution.recipients;

  if (recipients.length === 0) {
    return {
      ok: true,
      skipped: true,
      message: "Sin contacto operativo configurado",
    };
  }

  const propertyLabel = formatPropertyLabel(reservation.property);
  const code = reservation.reservationCode?.trim()
    ? ` (${reservation.reservationCode.trim()})`
    : "";
  const subject = `Registro pendiente de actualización · ${propertyLabel}`;
  const text = [
    `La ocupación de la reserva de ${reservation.guestName}${code} se actualizó.`,
    `Huéspedes esperados (adultos+niños): ${input.expectedGuests}.`,
    `Ya registrados: ${input.registeredGuests}.`,
    `Pendientes por registrar: ${input.pendingGuests}.`,
    `STAY permanece bloqueado hasta completar el registro.`,
    `Enlace de registro: ${input.guestRegistrationUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:560px;margin:0 auto">
      <h1 style="font-size:18px;margin:0 0 12px">Registro pendiente de actualización</h1>
      <p style="margin:0 0 12px;line-height:1.5">
        La ocupación de la reserva de <strong>${escapeHtml(reservation.guestName)}</strong>
        en <strong>${escapeHtml(propertyLabel)}</strong>${escapeHtml(code)} se actualizó manualmente.
      </p>
      <ul style="margin:0 0 12px;padding-left:18px;line-height:1.6">
        <li>Esperados (adultos+niños): <strong>${input.expectedGuests}</strong></li>
        <li>Registrados: <strong>${input.registeredGuests}</strong></li>
        <li>Pendientes: <strong>${input.pendingGuests}</strong></li>
      </ul>
      <p style="margin:0 0 12px;line-height:1.5">
        El portal STAY permanece bloqueado hasta que completen el registro.
      </p>
      <p style="margin:0">
        <a href="${escapeHtml(input.guestRegistrationUrl)}" style="color:#0ea5e9">
          Abrir enlace de registro
        </a>
      </p>
    </div>
  `;

  const failures: string[] = [];
  for (const to of recipients) {
    const result = await sendEmail({ to, subject, html, text });
    if (!result.ok) {
      failures.push(`${to}: ${result.message}`);
    }
  }

  if (failures.length === recipients.length) {
    return {
      ok: false,
      message: failures.join("; ") || "No se pudo enviar la notificación",
    };
  }

  return {
    ok: true,
    message:
      failures.length === 0
        ? "Notificación enviada"
        : `Enviado con fallos parciales: ${failures.join("; ")}`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
