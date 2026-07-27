import "server-only";

import { AccessCredentialDeliveryStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { formatAccessCode } from "@/lib/access-code";
import { pragmaEmailFooterHtml, pragmaEmailHeaderHtml } from "@/lib/brand-email";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send-email";
import { formatDate, formatDateTime } from "@/lib/helpers/date";
import { formatPropertyLabel } from "@/lib/property-display";
import { buildTenantRegistrationCompletedSubject } from "@/lib/guest-registration/reservation-event-email-subjects";
import { notifyAdminGuestRegistrationCompleted } from "@/services/guests/guest-registration-admin-notification.service";
import { notifyAccessCodeEmailForCredential } from "@/services/integrations/ttlock/ttlock-access-code-email.service";
import { processReservationAccessAfterRegistration } from "@/services/integrations/ttlock/ttlock-access.service";
import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";

function revalidateAccessCodeSurfaces() {
  try {
    revalidatePath("/calendar");
    revalidatePath("/panel");
    revalidatePath("/smart-access");
  } catch (error) {
    // Scripts / background jobs may lack Next request store.
    console.warn(
      "[gr-completion-comms] revalidate skipped:",
      error instanceof Error ? error.message : error,
    );
  }
}

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

export type GuestRegistrationCompletionCommsOptions = {
  /** Manual resend: force recepción + access-code emails even if already sent. */
  forceResend?: boolean;
  triggeredBy?: "auto" | "manual";
  userId?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notifyReceptionWithRetry(
  reservationId: string,
  options: GuestRegistrationCompletionCommsOptions,
  attempts = 3,
): Promise<GuestRegistrationCommsStepStatus> {
  let last: GuestRegistrationCommsStepStatus = {
    ok: false,
    message: "Sin intento",
  };

  for (let i = 0; i < attempts; i++) {
    const result = await notifyAdminGuestRegistrationCompleted(reservationId, {
      force: options.forceResend === true,
      triggeredBy: options.triggeredBy ?? "auto",
      userId: options.userId,
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
  checkIn: string | null;
  checkOut: string | null;
  accessCodePlain: string | null;
  accessValidFrom: string | null;
  accessValidTo: string | null;
  tenantEmail: string;
  reception: GuestRegistrationCommsStepStatus;
  accessCode: GuestRegistrationCommsStepStatus;
  ttlock: GuestRegistrationCommsStepStatus;
  forceResend: boolean;
}): Promise<GuestRegistrationCommsStepStatus> {
  const codeExists = Boolean(input.accessCodePlain?.trim());
  // If a synced code is already in DB, treat TTLock as OK even when this run's
  // generate step returned a transient/env failure (common after first GR fail).
  const ttlockOk = input.ttlock.ok || codeExists;
  const allOk = input.reception.ok && input.accessCode.ok && ttlockOk;
  const generatedAt = new Date().toISOString();
  const subject = buildTenantRegistrationCompletedSubject({
    guestName: input.guestName,
    propertyLabel: input.propertyLabel,
    allOk,
    forceResend: input.forceResend,
  });

  const ttlockLine = input.ttlock.ok
    ? stepLabel(input.ttlock)
    : codeExists
      ? `OK — código ya sincronizado (${input.accessCodePlain})`
      : stepLabel(input.ttlock);

  const lines = [
    "Registro completado",
    `Reporte generado: ${generatedAt}`,
    "",
    `Reserva: ${input.reservationCode ?? input.reservationId}`,
    `Huésped: ${input.guestName ?? "—"}`,
    `Propiedad: ${input.propertyLabel}`,
    input.checkIn ? `Check-in: ${input.checkIn}` : null,
    input.checkOut ? `Check-out: ${input.checkOut}` : null,
    input.forceResend
      ? "Origen: reenvío manual desde el panel"
      : "Origen: completado de registro",
    "",
    `Registro de huéspedes: completado`,
    `Código TTLock generado: ${ttlockOk ? "Sí" : "No"}`,
    `Código: ${input.accessCodePlain ?? "—"}`,
    input.accessValidFrom || input.accessValidTo
      ? `Vigencia: ${input.accessValidFrom ?? "—"} → ${input.accessValidTo ?? "—"}`
      : null,
    "",
    `Confirmación envío a recepción: ${stepLabel(input.reception)}`,
    `Confirmación envío al huésped: ${stepLabel(input.accessCode)}`,
    `Generación TTLock: ${ttlockLine}`,
    "",
    allOk
      ? "El proceso terminó correctamente. Recepción y huésped fueron notificados según el estado anterior."
      : "Hay fallos o pendientes. Revisa recepción / TTLock / correo del huésped en el panel.",
  ];

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:640px">
      ${pragmaEmailHeaderHtml()}
      <h1 style="font-size:20px;margin:0 0 16px">Registro completado</h1>
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280"><strong>Reporte generado:</strong> ${escapeHtml(generatedAt)}</p>
      <p style="margin:0 0 8px"><strong>Reserva:</strong> ${escapeHtml(input.reservationCode ?? input.reservationId)}</p>
      <p style="margin:0 0 8px"><strong>Huésped:</strong> ${escapeHtml(input.guestName ?? "—")}</p>
      <p style="margin:0 0 8px"><strong>Propiedad:</strong> ${escapeHtml(input.propertyLabel)}</p>
      ${
        input.checkIn
          ? `<p style="margin:0 0 8px"><strong>Check-in:</strong> ${escapeHtml(input.checkIn)}</p>`
          : ""
      }
      ${
        input.checkOut
          ? `<p style="margin:0 0 8px"><strong>Check-out:</strong> ${escapeHtml(input.checkOut)}</p>`
          : ""
      }
      <p style="margin:0 0 8px"><strong>Registro:</strong> Completado</p>
      <p style="margin:0 0 8px"><strong>Código TTLock generado:</strong> ${escapeHtml(
        ttlockOk ? "Sí" : "No",
      )}</p>
      <p style="margin:0 0 8px"><strong>Código:</strong> <span style="font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHtml(
        input.accessCodePlain ?? "—",
      )}</span></p>
      ${
        input.accessValidFrom || input.accessValidTo
          ? `<p style="margin:0 0 16px"><strong>Vigencia:</strong> ${escapeHtml(
              `${input.accessValidFrom ?? "—"} → ${input.accessValidTo ?? "—"}`,
            )}</p>`
          : `<p style="margin:0 0 16px"></p>`
      }
      <p style="margin:0 0 16px"><strong>Origen:</strong> ${escapeHtml(
        input.forceResend
          ? "Reenvío manual desde el panel"
          : "Completado de registro",
      )}</p>
      <ol style="margin:0 0 16px;padding-left:20px;line-height:1.6">
        <li>Confirmación envío a recepción: ${escapeHtml(stepLabel(input.reception))}</li>
        <li>Confirmación envío al huésped: ${escapeHtml(stepLabel(input.accessCode))}</li>
        <li>Generación TTLock: ${escapeHtml(ttlockLine)}</li>
      </ol>
      <p style="margin:0 0 8px">${escapeHtml(
        allOk
          ? "El proceso terminó correctamente. Recepción y huésped fueron notificados según el estado anterior."
          : "Hay fallos o pendientes. Revisa recepción / TTLock / correo del huésped en el panel.",
      )}</p>
      ${pragmaEmailFooterHtml()}
    </div>
  `.trim();

  const result = await sendEmail({
    to: input.tenantEmail,
    subject,
    html,
    text: lines.filter((line) => line !== null).join("\n"),
  });

  return {
    ok: result.ok,
    message: result.ok
      ? `Reporte enviado a ${input.tenantEmail}`
      : result.message,
  };
}

function summarizeCommsResult(
  result: GuestRegistrationCompletionCommsResult,
): { ok: boolean; message: string } {
  const parts = [
    `TTLock: ${result.ttlock.ok ? "OK" : result.ttlock.skipped ? "omitido" : "falló"}`,
    `Recepción: ${result.reception.ok ? "OK" : "falló"}`,
    `Código: ${result.accessCode.ok ? "OK" : "falló"}`,
    `Tenant: ${result.tenantReport.ok ? "OK" : "falló"}`,
  ];
  // Guest access is the critical path; recepción/tenant are ops notifications.
  if (result.accessCode.ok && result.ttlock.ok) {
    const opsOk = result.reception.ok && result.tenantReport.ok;
    return {
      ok: true,
      message: opsOk
        ? `Secuencia post-registro completa (${parts.join(" · ")})`
        : `Código generado y enviado; ops parcial (${parts.join(" · ")})`,
    };
  }
  return {
    ok: false,
    message: `Secuencia incompleta (${parts.join(" · ")}). ${result.accessCode.message || result.ttlock.message}`,
  };
}

/**
 * Post-GR communications (ordered):
 * 1) Generate TTLock code (without email)
 * 2) Email recepción about completed registration
 * 3) Email access code to guest + recepción when credential exists
 *    (independent of recepción success — guest must receive the code)
 * 4) Always → email tenant owner with delivery status of (2) and (3)
 */
export async function runGuestRegistrationCompletionComms(
  reservationId: string,
  options: GuestRegistrationCompletionCommsOptions = {},
): Promise<GuestRegistrationCompletionCommsResult> {
  const forceResend = options.forceResend === true;

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      reservationCode: true,
      guestName: true,
      guestRegistrationCompletedAt: true,
      propertyId: true,
      checkIn: true,
      checkOut: true,
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
        message:
          "Generación TTLock desactivada (generateAfterGuestRegistration=false)",
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

  // Code is persisted (or confirmed) here — refresh reservation detail surfaces
  // so AccessCredential appears on the next getReservationForInbox read.
  if (ttlock.ok) {
    revalidateAccessCodeSurfaces();
  }

  const reception = await notifyReceptionWithRetry(reservation.id, options);

  let accessCode: GuestRegistrationCommsStepStatus = {
    ok: false,
    skipped: true,
    message: "Sin código TTLock para enviar",
  };

  // Always resolve credential from DB after the TTLock step — do not gate on
  // ttlock.ok. Generation may fail while a prior synced code still exists, and
  // a successful generate must be found even if the status message varies.
  const credentialId =
    (
      await db.accessCredential.findFirst({
        where: {
          reservationId: reservation.id,
          ttlockCodeId: { not: null },
          status: {
            in: ["GENERATED", "SENT", "ACTIVE"],
          },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    )?.id ?? (await resolveActiveCredentialId(reservation.id));

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
    if (
      !forceResend &&
      existing?.deliveryStatus === AccessCredentialDeliveryStatus.SENT
    ) {
      accessCode = {
        ok: true,
        skipped: true,
        message: "Código ya había sido enviado",
      };
    } else {
      // Guest (+ ops) must get the code even if recepción notification failed.
      const sent = await notifyAccessCodeEmailForCredential(credentialId, {
        ignoreAutoSendFlag: true,
        forceResend,
      });
      accessCode = {
        ok: sent.ok,
        skipped: sent.skipped,
        message: sent.message,
      };
    }
  }

  const tenantEmail = await resolveTenantOwnerEmail(
    reservation.property.organizationId,
  );

  const credentialForTenant = credentialId
    ? await db.accessCredential.findUnique({
        where: { id: credentialId },
        select: {
          codeEncrypted: true,
          validFrom: true,
          validTo: true,
        },
      })
    : await db.accessCredential.findFirst({
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

  const accessCodePlain = credentialForTenant
    ? formatAccessCode(decryptTTLockSecret(credentialForTenant.codeEncrypted))
    : null;

  let tenantReport: GuestRegistrationCommsStepStatus;
  if (!tenantEmail) {
    tenantReport = {
      ok: false,
      message: "Tenant sin account owner con email activo",
    };
  } else if (
    !forceResend &&
    ttlock.ok &&
    reception.ok &&
    reception.skipped === true &&
    accessCode.ok &&
    accessCode.skipped === true
  ) {
    // Idempotent: recepción + código ya enviados → no reenviar reporte tenant.
    tenantReport = {
      ok: true,
      skipped: true,
      message: "Reporte tenant ya cubierto en el ciclo anterior",
    };
  } else {
    tenantReport = await notifyTenantDeliveryReport({
      reservationId: reservation.id,
      propertyLabel,
      guestName: reservation.guestName,
      reservationCode: reservation.reservationCode,
      checkIn: formatDate(reservation.checkIn),
      checkOut: formatDate(reservation.checkOut),
      accessCodePlain,
      accessValidFrom: credentialForTenant?.validFrom
        ? formatDateTime(credentialForTenant.validFrom)
        : null,
      accessValidTo: credentialForTenant?.validTo
        ? formatDateTime(credentialForTenant.validTo)
        : null,
      tenantEmail,
      reception,
      accessCode,
      ttlock,
      forceResend,
    });
  }

  console.info("[gr-completion-comms]", {
    reservationId,
    forceResend,
    triggeredBy: options.triggeredBy ?? "auto",
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

/**
 * Manual panel action: same ordered pipeline as auto-completion, with forced
 * re-send of recepción + access-code emails and a fresh tenant status report.
 */
export async function resendGuestRegistrationCompletionComms(
  reservationId: string,
  userId: string,
): Promise<{ ok: boolean; message: string; result: GuestRegistrationCompletionCommsResult }> {
  const result = await runGuestRegistrationCompletionComms(reservationId, {
    forceResend: true,
    triggeredBy: "manual",
    userId,
  });
  const summary = summarizeCommsResult(result);
  return { ...summary, result };
}

export function scheduleGuestRegistrationCompletionComms(
  reservationId: string,
): void {
  void runGuestRegistrationCompletionComms(reservationId).catch((error) => {
    console.error("[gr-completion-comms] Unhandled", reservationId, error);
  });
}

/**
 * Historical SSOT after GR complete:
 * 1) Await TTLock generation + DB persist + cache revalidation (code visible in
 *    reservation detail immediately).
 * 2) Fire-and-forget recepción / guest code / tenant emails so the guest form
 *    is not blocked on Resend latency. Idempotent if emails already ran.
 */
export async function settleGuestRegistrationCompletionComms(
  reservationId: string,
): Promise<GuestRegistrationCommsStepStatus> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      guestRegistrationCompletedAt: true,
      propertyId: true,
      property: { select: { ownerId: true } },
    },
  });

  if (!reservation?.guestRegistrationCompletedAt || !reservation.property) {
    return {
      ok: false,
      message: "Registro incompleto o sin propiedad",
    };
  }

  let ttlock: GuestRegistrationCommsStepStatus = {
    ok: false,
    message: "Pendiente",
  };

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
        message:
          "Generación TTLock desactivada (generateAfterGuestRegistration=false)",
      };
    } else {
      ttlock = { ok: gen.ok, message: gen.message };
    }
  } catch (error) {
    ttlock = {
      ok: false,
      message:
        error instanceof Error ? error.message : "Error generando código TTLock",
    };
  }

  if (ttlock.ok) {
    revalidateAccessCodeSurfaces();
  }

  // Emails + tenant report (idempotent). TTLock step inside will reuse credential.
  scheduleGuestRegistrationCompletionComms(reservationId);

  return ttlock;
}
