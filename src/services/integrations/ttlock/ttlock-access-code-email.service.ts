import "server-only";

import {
  AccessCredentialDeliveryStatus,
  AccessCredentialStatus,
} from "@prisma/client";
import {
  buildAccessCodeGuestMessage,
  type AccessCodeCopyContext,
} from "@/lib/access-code-guest-message";
import { formatAccessCode } from "@/lib/access-code";
import { prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send-email";
import {
  parseOperationalContacts,
  findOperationalContactByKey,
  resolveGuestRegistrationAdminRecipients,
} from "@/lib/operational-contacts";
import { GUEST_ACCESS_CODE_EMAIL_SUBJECT } from "@/lib/guest-registration/reservation-event-email-subjects";
import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";
import { resolveTTLockAutomationSettingsForProperty } from "@/modules/integrations/ttlock/ttlock.persistence";

export { GUEST_ACCESS_CODE_EMAIL_SUBJECT };

export type NotifyAccessCodeEmailResult = {
  ok: boolean;
  message: string;
  skipped?: boolean;
  providerIds?: Record<string, string>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildAccessCodeEmailSubject(): string {
  return GUEST_ACCESS_CODE_EMAIL_SUBJECT;
}

function buildReceptionContactHtml(contact: {
  name: string;
  email: string | null;
  whatsapp: string | null;
} | null): string {
  if (!contact) {
    return `<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#4b5563">Si necesitas ayuda con el acceso, contacta a recepción.</p>`;
  }
  const lines = [
    contact.email
      ? `<p style="margin:0 0 4px;font-size:14px;line-height:1.5">Correo: ${escapeHtml(contact.email)}</p>`
      : "",
    contact.whatsapp
      ? `<p style="margin:0;font-size:14px;line-height:1.5">WhatsApp: ${escapeHtml(contact.whatsapp)}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `
    <h2 style="font-size:15px;margin:24px 0 8px;color:#111827">Contacto de recepción</h2>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.5"><strong>${escapeHtml(contact.name)}</strong></p>
    ${lines || `<p style="margin:0;font-size:14px;color:#4b5563">Disponible a través del canal de la reserva.</p>`}
  `;
}

function buildAccessCodeEmailHtml(
  plainMessage: string,
  code: string,
  receptionContact: {
    name: string;
    email: string | null;
    whatsapp: string | null;
  } | null,
): string {
  const lines = plainMessage.split("\n").map((line) => {
    if (line.includes(code)) {
      const safe = escapeHtml(line);
      const safeCode = escapeHtml(code);
      return `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${safe.replace(
        safeCode,
        `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;letter-spacing:0.04em">${safeCode}</span>`,
      )}</p>`;
    }
    if (!line.trim()) return `<p style="margin:0 0 8px">&nbsp;</p>`;
    return `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#111827">${escapeHtml(line)}</p>`;
  });

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:640px">
      <h1 style="font-size:20px;margin:0 0 8px">Bienvenido</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4b5563">
        Tu código de acceso ya está disponible. Guárdalo para tu llegada.
      </p>
      ${lines.join("\n")}
      <p style="margin:20px 0 8px;font-size:13px;color:#6b7280">
        Código para copiar:
      </p>
      <p style="margin:0 0 8px">
        <code style="display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:22px;letter-spacing:0.06em;background:#f3f4f6;padding:10px 16px;border-radius:8px">${escapeHtml(code)}</code>
      </p>
      <p style="margin:0 0 16px;font-size:12px;color:#6b7280">
        Selecciona el código y cópialo (Ctrl+C / ⌘+C).
      </p>
      ${buildReceptionContactHtml(receptionContact)}
    </div>
  `.trim();
}

async function claimAccessCodeEmailSend(
  credentialId: string,
  forceResend = false,
): Promise<boolean> {
  const claimed = await db.accessCredential.updateMany({
    where: {
      id: credentialId,
      status: {
        in: [
          AccessCredentialStatus.GENERATED,
          AccessCredentialStatus.ACTIVE,
          AccessCredentialStatus.SENT,
        ],
      },
      OR: forceResend
        ? [
            { deliveryStatus: AccessCredentialDeliveryStatus.NOT_SENT },
            { deliveryStatus: AccessCredentialDeliveryStatus.FAILED },
            { deliveryStatus: AccessCredentialDeliveryStatus.SENT },
          ]
        : [
            { deliveryStatus: AccessCredentialDeliveryStatus.NOT_SENT },
            { deliveryStatus: AccessCredentialDeliveryStatus.FAILED },
          ],
    },
    data: {
      deliveryStatus: AccessCredentialDeliveryStatus.PENDING,
    },
  });
  return claimed.count === 1;
}

function resolveGuestRecipient(input: {
  reservationGuestEmail: string | null;
  ownerGuestEmail: string | null;
}): string | null {
  const email =
    input.reservationGuestEmail?.trim().toLowerCase() ||
    input.ownerGuestEmail?.trim().toLowerCase() ||
    null;
  if (!email || !email.includes("@")) return null;
  return email;
}

/**
 * Envía el mensaje de acceso existente (sin **markdown**) al huésped titular
 * y al Contacto Operativo, reutilizando sendEmail / Resend / branding.
 */
export async function notifyAccessCodeEmailForCredential(
  credentialId: string,
  options: { ignoreAutoSendFlag?: boolean; forceResend?: boolean } = {},
): Promise<NotifyAccessCodeEmailResult> {
  try {
    const forceResend = options.forceResend === true;
    const credential = await db.accessCredential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        status: true,
        deliveryStatus: true,
        ttlockCodeId: true,
        codeEncrypted: true,
        reservation: {
          select: {
            id: true,
            guestName: true,
            guestEmail: true,
            checkIn: true,
            checkOut: true,
            propertyId: true,
            guests: {
              where: { isReservationOwner: true },
              take: 1,
              select: { email: true, fullName: true },
            },
            property: {
              select: {
                name: true,
                unitNumber: true,
                propertyType: true,
                checkInTime: true,
                checkOutTime: true,
                notificationEmails: true,
                operationalContacts: true,
                guestRegistrationContactKey: true,
              },
            },
          },
        },
      },
    });

    if (!credential) {
      return { ok: false, message: "Credencial no encontrada", skipped: true };
    }

    if (!options.ignoreAutoSendFlag) {
      const settings = await resolveTTLockAutomationSettingsForProperty(
        credential.reservation.propertyId,
      );
      if (!settings?.autoSendCode) {
        return {
          ok: true,
          message: "Envío automático de código desactivado en la integración TTLock",
          skipped: true,
        };
      }
    }

    // Never email a local-only / unsynced code — guest must receive a real TTLock passcode.
    if (!credential.ttlockCodeId) {
      return {
        ok: false,
        message:
          "Código no registrado en TTLock; no se envía al huésped hasta sincronizar la cerradura",
        skipped: true,
      };
    }

    if (
      !forceResend &&
      credential.deliveryStatus === AccessCredentialDeliveryStatus.SENT
    ) {
      return { ok: true, message: "El código ya fue enviado", skipped: true };
    }

    if (credential.deliveryStatus === AccessCredentialDeliveryStatus.PENDING) {
      return {
        ok: true,
        message: "Envío de código en curso",
        skipped: true,
      };
    }

    const claimed = await claimAccessCodeEmailSend(credentialId, forceResend);
    if (!claimed) {
      return {
        ok: false,
        message: "No se pudo iniciar el envío (ya enviado o en curso)",
        skipped: true,
      };
    }

    const code = formatAccessCode(decryptTTLockSecret(credential.codeEncrypted));
    if (!code) {
      await db.accessCredential.update({
        where: { id: credentialId },
        data: { deliveryStatus: AccessCredentialDeliveryStatus.FAILED },
      });
      return { ok: false, message: "Código de acceso inválido" };
    }

    const property = credential.reservation.property;
    const messageCtx: AccessCodeCopyContext = {
      code,
      propertyType: property.propertyType,
      propertyName: property.name,
      unitNumber: property.unitNumber,
      checkIn: prismaDateToKey(credential.reservation.checkIn),
      checkOut: prismaDateToKey(credential.reservation.checkOut),
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
    };

    const plainMessage = buildAccessCodeGuestMessage(messageCtx, {
      codeStyle: "plain",
    });
    if (!plainMessage) {
      await db.accessCredential.update({
        where: { id: credentialId },
        data: { deliveryStatus: AccessCredentialDeliveryStatus.FAILED },
      });
      return { ok: false, message: "No se pudo armar el mensaje de acceso" };
    }

    const guestTo = resolveGuestRecipient({
      reservationGuestEmail: credential.reservation.guestEmail,
      ownerGuestEmail: credential.reservation.guests[0]?.email ?? null,
    });

    const ops = resolveGuestRegistrationAdminRecipients({
      notificationEmails: property.notificationEmails,
      operationalContacts: property.operationalContacts,
      guestRegistrationContactKey: property.guestRegistrationContactKey,
    });

    const contacts = parseOperationalContacts(property.operationalContacts);
    const receptionContact =
      ops.selectedContact ??
      findOperationalContactByKey(
        contacts,
        property.guestRegistrationContactKey,
      ) ??
      contacts.find((c) => c.isActive) ??
      null;

    const recipients = Array.from(
      new Set(
        [guestTo, ...ops.recipients].filter(
          (email): email is string => Boolean(email),
        ),
      ),
    );

    if (recipients.length === 0) {
      await db.accessCredential.update({
        where: { id: credentialId },
        data: { deliveryStatus: AccessCredentialDeliveryStatus.FAILED },
      });
      return {
        ok: false,
        message:
          "Sin destinatarios: configura el correo del huésped y/o un Contacto Operativo",
      };
    }

    const subject = buildAccessCodeEmailSubject();
    const html = buildAccessCodeEmailHtml(plainMessage, code, receptionContact);
    const text = [
      plainMessage,
      "",
      `Código: ${code}`,
      receptionContact
        ? `Contacto de recepción: ${receptionContact.name}${
            receptionContact.email ? ` · ${receptionContact.email}` : ""
          }${
            receptionContact.whatsapp
              ? ` · WhatsApp ${receptionContact.whatsapp}`
              : ""
          }`
        : "Si necesitas ayuda con el acceso, contacta a recepción.",
    ].join("\n");

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

    if (failures.length === recipients.length) {
      await db.accessCredential.update({
        where: { id: credentialId },
        data: { deliveryStatus: AccessCredentialDeliveryStatus.FAILED },
      });
      return {
        ok: false,
        message: failures.join("; "),
        providerIds,
      };
    }

    await db.accessCredential.update({
      where: { id: credentialId },
      data: {
        deliveryStatus: AccessCredentialDeliveryStatus.SENT,
        status:
          credential.status === AccessCredentialStatus.GENERATED
            ? AccessCredentialStatus.SENT
            : credential.status,
      },
    });

    return {
      ok: true,
      message:
        failures.length > 0
          ? `Enviado con errores parciales: ${failures.join("; ")}`
          : "Código de acceso enviado por correo",
      providerIds,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al enviar código por correo";
    console.error("[ttlock-access-code-email]", credentialId, error);
    await db.accessCredential
      .update({
        where: { id: credentialId },
        data: { deliveryStatus: AccessCredentialDeliveryStatus.FAILED },
      })
      .catch(() => undefined);
    return { ok: false, message };
  }
}

export function scheduleAccessCodeEmailForCredential(
  credentialId: string,
): void {
  void notifyAccessCodeEmailForCredential(credentialId).catch((error) => {
    console.error(
      "[ttlock-access-code-email] Unhandled",
      credentialId,
      error,
    );
  });
}
