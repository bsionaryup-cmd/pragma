import "server-only";

import { AccessCredentialDeliveryStatus } from "@prisma/client";
import { pragmaEmailFooterHtml, pragmaEmailHeaderHtml } from "@/lib/brand-email";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send-email";
import { formatPropertyLabel } from "@/lib/property-display";
import { notifyAdminGuestRegistrationCompleted } from "@/services/guests/guest-registration-admin-notification.service";
import { notifyAccessCodeEmailForCredential } from "@/services/integrations/ttlock/ttlock-access-code-email.service";
import { processReservationAccessAfterRegistration } from "@/services/integrations/ttlock/ttlock-access.service";

export type GuestRegistrationCommsStepStatus = {
  ok: boolean;
  skipped?: boolean;
  message: string;
};

export type GuestRegistrationCompletionCommsResult = {
  reservationId: string;
  ttlock: GuestRegistrationCommsStepStatus;
  reception: GuestRegistrationCommsStepStatus;
  accessCode: GuestRegistrationCommsStepStatus;
  tenantReport: GuestRegistrationCommsStepStatus;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notifyReceptionWithRetry(
  reservationId: string,
  attempts = 3,
): Promise<GuestRegistrationCommsStepStatus> {
  let last: GuestRegistrationCommsStepStatus = {
    ok: false,
    message: "Sin intento",
  };

  for (let i = 0; i < attempts; i++) {
    const result = await notifyAdminGuestRegistrationCompleted(reservationId, {
      triggeredBy: "auto",
    });
    last = {
      ok: result.ok,
      skipped: result.skipped,
      message: result.message,
    };
    if (result.ok) return last;
    if (result.skipped && !result.ok) {
      // In-progress claim — wait and retry
      await sleep(400 * (i + 1));
      continue;
    }
    if (!result.ok && !result.skipped) {
      await sleep(500 * (i + 1));
      continue;
    }
  }

  return last;
}

async function resolveActiveCredentialId(
  reservationId: string,
): Promise<string | null> {
  const credential = await db.accessCredential.findFirst({
    where: {
      reservationId,
      ttlockCodeId: { not: null },
      deliveryStatus: {
        in: [
          AccessCredentialDeliveryStatus.NOT_SENT,
          AccessCredentialDeliveryStatus.FAILED,
          AccessCredentialDeliveryStatus.PENDING,
          AccessCredentialDeliveryStatus.SENT,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, deliveryStatus: true },
  });
  return credential?.id ?? null;
}

async function resolveTenantOwnerEmail(
  organizationId: string | null | undefined,
): Promise<string | null> {
  if (!organizationId) return null;
  const owner = await db.user.findFirst({
    where: {
      organizationId,
      isAccountOwner: true,
      deletedAt: null,
      isActive: true,
    },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  const email = owner?.email?.trim().toLowerCase() ?? null;
  if (!email || !email.includes("@")) return null;
  return email;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stepLabel(step: GuestRegistrationCommsStepStatus): string {
  if (step.ok && step.skipped) return `OK (ya enviado) — ${step.message}`;
  if (step.ok) return `OK — ${step.message}`;
  if (step.skipped) return `Omitido — ${step.message}`;
  return `FALLÓ — ${step.message}`;
}

async function notifyTenantDeliveryReport(input: {
  reservationId: string;
  propertyLabel: string;
  guestName: string | null;
  reservationCode: string | null;
  tenantEmail: string;
  reception: GuestRegistrationCommsStepStatus;
  accessCode: GuestRegistrationCommsStepStatus;
  ttlock: GuestRegistrationCommsStepStatus;
}): Promise<GuestRegistrationCommsStepStatus> {
  const allOk = input.reception.ok && input.accessCode.ok;
  const subject = allOk
    ? `PRAGMA · Notificaciones GR OK — ${input.propertyLabel}`
    : `PRAGMA · Revisar notificaciones GR — ${input.propertyLabel}`;

  const lines = [
    `Reserva: ${input.reservationCode ?? input.reservationId}`,
    `Huésped: ${input.guestName ?? "—"}`,
    `Propiedad: ${input.propertyLabel}`,
    "",
    `1) Correo a recepción (registro completado): ${stepLabel(input.reception)}`,
    `2) Generación TTLock: ${stepLabel(input.ttlock)}`,
    `3) Correo de código (huésped + recepción): ${stepLabel(input.accessCode)}`,
    "",
    allOk
      ? "Ambas notificaciones se enviaron correctamente."
      : "Hay fallos o pendientes. Revisa recepción / TTLock / correo del huésped en el panel.",
  ];

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:640px">
      ${pragmaEmailHeaderHtml()}
      <h1 style="font-size:20px;margin:0 0 16px">Estado de notificaciones · Registro de huéspedes</h1>
      <p style="margin:0 0 8px"><strong>Reserva:</strong> ${escapeHtml(input.reservationCode ?? input.reservationId)}</p>
      <p style="margin:0 0 8px"><strong>Huésped:</strong> ${escapeHtml(input.guestName ?? "—")}</p>
      <p style="margin:0 0 16px"><strong>Propiedad:</strong> ${escapeHtml(input.propertyLabel)}</p>
      <ol style="margin:0 0 16px;padding-left:20px;line-height:1.6">
        <li>Correo a recepción (registro): ${escapeHtml(stepLabel(input.reception))}</li>
        <li>Generación TTLock: ${escapeHtml(stepLabel(input.ttlock))}</li>
        <li>Correo de código (huésped + recepción): ${escapeHtml(stepLabel(input.accessCode))}</li>
      </ol>
      <p style="margin:0 0 8px">${escapeHtml(
        allOk
          ? "Ambas notificaciones se enviaron correctamente."
          : "Hay fallos o pendientes. Revisa recepción / TTLock / correo del huésped en el panel.",
      )}</p>
      ${pragmaEmailFooterHtml()}
    </div>
  `.trim();

  const result = await sendEmail({
    to: input.tenantEmail,
    subject,
    html,
    text: lines.join("\n"),
  });

  return {
    ok: result.ok,
    message: result.ok
      ? `Reporte enviado a ${input.tenantEmail}`
      : result.message,
  };
}

/**
 * Post-GR communications (ordered):
 * 1) Generate TTLock code (without email)
 * 2) Email recepción about completed registration
 * 3) Only if (2) ok → email access code to guest + recepción
 * 4) Always → email tenant owner with delivery status of (2) and (3)
 */
export async function runGuestRegistrationCompletionComms(
  reservationId: string,
): Promise<GuestRegistrationCompletionCommsResult> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      reservationCode: true,
      guestName: true,
      guestRegistrationCompletedAt: true,
      propertyId: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
          organizationId: true,
          ownerId: true,
        },
      },
    },
  });

  const empty = (message: string): GuestRegistrationCommsStepStatus => ({
    ok: false,
    message,
  });

  if (!reservation?.guestRegistrationCompletedAt || !reservation.property) {
    return {
      reservationId,
      ttlock: empty("Registro incompleto o sin propiedad"),
      reception: empty("No aplica"),
      accessCode: empty("No aplica"),
      tenantReport: empty("No aplica"),
    };
  }

  const propertyLabel = formatPropertyLabel(reservation.property);

  let ttlock: GuestRegistrationCommsStepStatus = empty("Pendiente");
  try {
    const gen = await processReservationAccessAfterRegistration({
      reservationId: reservation.id,
      propertyId: reservation.propertyId,
      ownerId: reservation.property.ownerId,
      skipAccessCodeEmail: true,
    });
    if (!gen) {
      ttlock = {
        ok: false,
        skipped: true,
        message: "Generación TTLock desactivada (generateAfterGuestRegistration=false)",
      };
    } else {
      ttlock = {
        ok: gen.ok,
        message: gen.message,
      };
    }
  } catch (error) {
    ttlock = {
      ok: false,
      message:
        error instanceof Error ? error.message : "Error generando código TTLock",
    };
  }

  const reception = await notifyReceptionWithRetry(reservation.id);

  let accessCode: GuestRegistrationCommsStepStatus = {
    ok: false,
    skipped: true,
    message: "Esperando correo de recepción exitoso",
  };

  if (reception.ok) {
    const credentialId =
      (ttlock.ok
        ? (
            await db.accessCredential.findFirst({
              where: { reservationId: reservation.id, ttlockCodeId: { not: null } },
              orderBy: { createdAt: "desc" },
              select: { id: true },
            })
          )?.id
        : null) ?? (await resolveActiveCredentialId(reservation.id));

    if (!credentialId) {
      accessCode = {
        ok: false,
        message:
          "No hay código TTLock sincronizado (ttlockCodeId) para enviar por correo",
      };
    } else {
      const existing = await db.accessCredential.findUnique({
        where: { id: credentialId },
        select: { deliveryStatus: true },
      });
      if (existing?.deliveryStatus === AccessCredentialDeliveryStatus.SENT) {
        accessCode = {
          ok: true,
          skipped: true,
          message: "Código ya había sido enviado",
        };
      } else {
        // Completion pipeline always sends (guest + recepción), even if autoSendCode is off.
        const sent = await notifyAccessCodeEmailForCredential(credentialId, {
          ignoreAutoSendFlag: true,
        });
        accessCode = {
          ok: sent.ok,
          skipped: sent.skipped,
          message: sent.message,
        };
      }
    }
  }

  const tenantEmail = await resolveTenantOwnerEmail(
    reservation.property.organizationId,
  );

  let tenantReport: GuestRegistrationCommsStepStatus;
  if (!tenantEmail) {
    tenantReport = {
      ok: false,
      message: "Tenant sin account owner con email activo",
    };
  } else {
    tenantReport = await notifyTenantDeliveryReport({
      reservationId: reservation.id,
      propertyLabel,
      guestName: reservation.guestName,
      reservationCode: reservation.reservationCode,
      tenantEmail,
      reception,
      accessCode,
      ttlock,
    });
  }

  console.info("[gr-completion-comms]", {
    reservationId,
    ttlock,
    reception,
    accessCode,
    tenantReport,
  });

  return {
    reservationId,
    ttlock,
    reception,
    accessCode,
    tenantReport,
  };
}

export function scheduleGuestRegistrationCompletionComms(
  reservationId: string,
): void {
  void runGuestRegistrationCompletionComms(reservationId).catch((error) => {
    console.error("[gr-completion-comms] Unhandled", reservationId, error);
  });
}
