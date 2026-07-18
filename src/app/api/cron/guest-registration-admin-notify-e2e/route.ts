import { NextResponse } from "next/server";

import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";

import { BookingPlatform, ReservationStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { resolveGuestRegistrationAdminRecipients } from "@/lib/operational-contacts";
import { getGuestRegistrationMaxCapacity } from "@/lib/guest-registration/guest-registration-capacity";
import {
  ensureGuestRegistrationForReservation,
  registerGuestStep,
  completeGuestRegistration,
} from "@/services/guests/guest-registration.service";
import {
  parseGuestRegistrationAdminNotificationLog,
} from "@/lib/guest-registration/guest-registration-admin-notification-log";
import { buildGuestRegistrationAdminEmailHtml } from "@/services/guests/guest-registration-admin-notification.content";
import { shouldSimulateEmailDelivery } from "@/lib/email/send-email";
import { formatDate } from "@/lib/helpers/date";
import {
  notifyAdminGuestRegistrationCompleted,
  resendAdminGuestRegistrationNotification,
} from "@/services/guests/guest-registration-admin-notification.service";

function extractTokenFromUrl(url: string): string {
  const parts = url.split("/").filter(Boolean);
  return parts[parts.length - 1]!;
}

function pickTestRecipients(recipients: string[]): string[] {
  return recipients.filter((email) => {
    const e = email.toLowerCase();
    return (
      e.includes("test") ||
      e.includes("example.com") ||
      e.endsWith("@example.com") ||
      e.endsWith("@localhost") ||
      e.endsWith("@test.com")
    );
  });
}

async function waitForAdminNotification(
  reservationId: string,
  options: { timeoutMs: number },
) {
  const start = Date.now();
  while (Date.now() - start < options.timeoutMs) {
    const row = await db.reservation.findUnique({
      where: { id: reservationId },
      select: {
        reservationCode: true,
        guestRegistrationCompletedAt: true,
        guestRegistrationAdminNotifiedAt: true,
        guestRegistrationAdminNotificationError: true,
        guestRegistrationAdminNotificationLog: true,
      },
    });
    if (!row) throw new Error("Reservation not found while waiting");

    const log = parseGuestRegistrationAdminNotificationLog(
      row.guestRegistrationAdminNotificationLog,
    );
    if (row.guestRegistrationCompletedAt && log.length > 0) {
      return { row, log };
    }
    await delay(1000);
  }
  throw new Error("Timeout esperando log de notificación admin");
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "E2E endpoint no disponible en producción" },
      { status: 403 },
    );
  }

  const simulation = shouldSimulateEmailDelivery();
  const resolvedResendMode = simulation ? "simulado" : "real";

  const candidateReservations = await db.reservation.findMany({
    where: {
      guestRegistrationCompletedAt: null,
      platform: BookingPlatform.DIRECT,
      reservationCode: null,
      status: {
        in: [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKED_IN,
          ReservationStatus.CHECKOUT_TODAY,
        ],
      },
    },
    take: 50,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      platform: true,
      adults: true,
      children: true,
      infants: true,
      checkIn: true,
      checkOut: true,
      property: {
        select: {
          id: true,
          name: true,
          unitNumber: true,
          notificationEmails: true,
          operationalContacts: true,
          guestRegistrationContactKey: true,
        },
      },
    },
  });

  const eligible: Array<{
    reservation: (typeof candidateReservations)[number];
    recipients: string[];
    recipientSource: "operational-contact" | "legacy-notification-emails";
    selectedContactKey: string | null;
  }> = [];

  for (const r of candidateReservations) {
    const resolution = resolveGuestRegistrationAdminRecipients({
      notificationEmails: r.property.notificationEmails,
      operationalContacts: r.property.operationalContacts,
      guestRegistrationContactKey: r.property.guestRegistrationContactKey,
    });
    const recipients = resolution.recipients;
    if (recipients.length === 0) continue;

    const maxCapacity = getGuestRegistrationMaxCapacity({
      platform: r.platform,
      adults: r.adults,
      children: r.children,
      infants: r.infants,
    });
    if (maxCapacity < 2) continue;

    eligible.push({
      reservation: r,
      recipients,
      recipientSource: resolution.source,
      selectedContactKey: resolution.selectedContact?.key ?? null,
    });
  }

  if (eligible.length === 0) {
    const properties = await db.property.findMany({
      take: 30,
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        unitNumber: true,
        notificationEmails: true,
        operationalContacts: true,
        guestRegistrationContactKey: true,
      },
    });

    const propertiesWithRecipients = properties
      .map((p) => {
        const resolution = resolveGuestRegistrationAdminRecipients({
          notificationEmails: p.notificationEmails,
          operationalContacts: p.operationalContacts,
          guestRegistrationContactKey: p.guestRegistrationContactKey,
        });
        const label = `${p.unitNumber ?? ""}${p.unitNumber ? " " : ""}${p.name}`.trim();
        return {
          id: p.id,
          label,
          recipients: resolution.recipients,
          recipientSource: resolution.source,
          selectedContactKey: resolution.selectedContact?.key ?? null,
        };
      })
      .filter((p) => p.recipients.length > 0);

    return NextResponse.json(
      {
        ok: false,
        error:
          "No se encontraron reservas elegibles con destinatarios configurados (Contacto Operativo o notificationEmails).",
        mode: resolvedResendMode,
        diagnostics: {
          propertiesWithRecipientsCount: propertiesWithRecipients.length,
          samplePropertiesWithRecipients:
            propertiesWithRecipients.slice(0, 10),
          candidateReservationsCount: candidateReservations.length,
        },
      },
      { status: 400 },
    );
  }

  let chosen: (typeof eligible)[number] | undefined;
  if (simulation) {
    chosen = eligible[0];
  } else {
    chosen = eligible.find(
      ({ recipients }) => pickTestRecipients(recipients).length > 0,
    );
    if (!chosen) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "RESEND_API_KEY presente (envío real). No encontré destinatarios claramente 'test'. " +
            "Configura una propiedad de prueba con correos de test o ejecuta de nuevo sin RESEND_API_KEY.",
        },
        { status: 400 },
      );
    }
  }

  const { reservation, recipients, recipientSource, selectedContactKey } = chosen;
  const tokenUrl = await ensureGuestRegistrationForReservation(reservation.id);
  if (!tokenUrl) {
    return NextResponse.json(
      { ok: false, error: "No se pudo generar token" },
      { status: 500 },
    );
  }
  const token = extractTokenFromUrl(tokenUrl);

  const stamp = randomUUID().slice(0, 8).toUpperCase();
  const ownerDoc = `900${stamp}`.slice(0, 10);
  const companionDoc = `901${stamp}`.slice(0, 10);
  const ownerEmail = `e2e-owner-${stamp.toLowerCase()}@example.com`;

  const canonicalProfile = {
    nationality: "CO",
    dateOfBirth: "1990-03-12",
    sex: "M" as const,
    travelMotive: "LEISURE" as const,
    occupation: "Auditoría E2E",
    residenceCountry: "CO",
    residenceAdminArea: "Antioquia",
    residenceCity: "Medellín",
    originCountry: "CO",
    originAdminArea: "Antioquia",
    originCity: "Medellín",
    destinationCountry: "CO",
    destinationAdminArea: "Antioquia",
    destinationCity: "Medellín",
  };

  await registerGuestStep({
    token,
    firstName: "E2E",
    lastName: `Titular-${stamp}`,
    documentType: "CC",
    documentNumber: ownerDoc,
    email: ownerEmail,
    phone: "+57 3001234567",
    ...canonicalProfile,
  });

  await registerGuestStep({
    token,
    firstName: "E2E",
    lastName: `Acompañante-${stamp}`,
    documentType: "CC",
    documentNumber: companionDoc,
    ...canonicalProfile,
    dateOfBirth: "1992-08-05",
  });

  await completeGuestRegistration(
    {
      token,
      confirmAllGuests: true,
      acceptLodgingContract: true,
      acceptHabeasData: true,
      locale: "es-CO",
    },
    {
      ipAddress: "127.0.0.1",
      userAgent: "guest-registration-admin-notify-e2e",
    },
  );

  const autoNotifyResult = await notifyAdminGuestRegistrationCompleted(
    reservation.id,
    { triggeredBy: "auto" },
  );

  const { row: afterAuto, log: afterAutoLog } =
    await waitForAdminNotification(reservation.id, { timeoutMs: 60_000 });
  const lastAuto = afterAutoLog[afterAutoLog.length - 1];

  const userId = `e2e-user-${stamp.toLowerCase()}`;
  const manualResult = await resendAdminGuestRegistrationNotification(
    reservation.id,
    userId,
  );

  const { row: afterManualRow, log: afterManualLog } =
    await waitForAdminNotification(reservation.id, { timeoutMs: 60_000 });
  const lastManual = afterManualLog[afterManualLog.length - 1];

  const concurrent = await Promise.allSettled([
    resendAdminGuestRegistrationNotification(reservation.id, `${userId}-1`),
    resendAdminGuestRegistrationNotification(reservation.id, `${userId}-2`),
  ]);

  const { log: afterConcurrentLog } = await waitForAdminNotification(
    reservation.id,
    { timeoutMs: 60_000 },
  );

  const ownerName = `E2E Titular-${stamp}`;
  const companionName = `E2E Acompañante-${stamp}`;

  const htmlPreview = buildGuestRegistrationAdminEmailHtml({
    reservationCode: afterAuto.reservationCode ?? null,
    propertyLabel: `${reservation.property.unitNumber ? `${reservation.property.unitNumber} ` : ""}${reservation.property.name}`,
    checkIn: formatDate(reservation.checkIn),
    checkOut: formatDate(reservation.checkOut),
    guestCount: 2,
    primaryGuest: {
      fullName: ownerName,
      documentType: "CC",
      documentNumber: ownerDoc,
      nationality: "Colombia",
      dateOfBirth: formatDate(new Date(Date.UTC(1990, 2, 12))),
      email: ownerEmail,
      phone: "+57 3001234567",
    },
    companions: [
      {
        fullName: companionName,
        documentType: "CC",
        documentNumber: companionDoc,
        nationality: "Colombia",
        dateOfBirth: formatDate(new Date(Date.UTC(1992, 7, 5))),
      },
    ],
  } as any);

  return NextResponse.json({
    ok: true,
    mode: resolvedResendMode,
    evidence: {
      reservationId: reservation.id,
      token,
      recipients,
      recipientSource,
      selectedContactKey,
      logs: {
        autoLast: lastAuto,
        manualLast: lastManual,
        logLenAfterAuto: afterAutoLog.length,
        logLenAfterManual: afterManualLog.length,
        logLenAfterConcurrent: afterConcurrentLog.length,
      },
      lockSignal: {
        guestRegistrationAdminNotificationError:
          afterManualRow.guestRegistrationAdminNotificationError,
        guestRegistrationAdminNotifiedAt:
          afterManualRow.guestRegistrationAdminNotifiedAt?.toISOString() ?? null,
      },
      htmlPreviewIncludes: {
        ownerName: htmlPreview.includes(ownerName),
        companionName: htmlPreview.includes(companionName),
        pragmaBrand: htmlPreview.toLowerCase().includes("pragma"),
      },
      manualResult,
      autoNotifyResult,
      concurrent,
    },
  });
}

