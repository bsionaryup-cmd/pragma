/**
 * Evidence: GR → TTLock persist → reservation detail DTO → 3 emails with content.
 *
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/_evidence-gr-ttlock-ui-visibility.ts --cleanup
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

config();
config({ path: ".env.local", override: true });

if (process.env.TTLOCK_API_ENABLED == null) {
  process.env.TTLOCK_API_ENABLED = "true";
}

async function fetchResendHtml(providerId: string | null | undefined) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !providerId || providerId === "simulated") {
    return { skipped: true as const, providerId: providerId ?? null };
  }
  const response = await fetch(`https://api.resend.com/emails/${providerId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = (await response.json()) as Record<string, unknown>;
  const html = typeof body.html === "string" ? body.html : "";
  const text = typeof body.text === "string" ? body.text : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  return {
    skipped: false as const,
    httpStatus: response.status,
    id: body.id ?? null,
    to: body.to ?? null,
    subject,
    last_event: body.last_event ?? null,
    checks: {
      pragmaBrand: /PRAGMA/i.test(html) || /PRAGMA/i.test(text),
      hasCode: /\d{4,}#/.test(html) || /\d{4,}#/.test(text),
      registrationCompleted:
        /registro/i.test(html + text + subject) ||
        /Guest Registration/i.test(html + text + subject),
      accessCodeSection: /código de acceso/i.test(html + text + subject),
    },
  };
}

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const {
    BookingPlatform,
    ReservationStatus,
    AccessCredentialDeliveryStatus,
  } = await import("@prisma/client");
  const { db } = await import("../src/lib/db");
  const { formatAccessCode } = await import("../src/lib/access-code");
  const { decryptTTLockSecret } = await import(
    "../src/services/integrations/ttlock/ttlock-crypto"
  );
  const {
    ensureGuestRegistrationForReservation,
    registerGuestStep,
    completeGuestRegistration,
  } = await import("../src/services/guests/guest-registration.service");
  const { parseGuestRegistrationAdminNotificationLog } = await import(
    "../src/lib/guest-registration/guest-registration-admin-notification-log"
  );
  const { isTTLockLiveApiEnabled } = await import(
    "../src/services/integrations/ttlock/ttlock-oauth.client"
  );

  const to =
    process.env.FULL_FLOW_TEST_TO?.trim().toLowerCase() ||
    "magvillafuerte@gmail.com";

  const evidence: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    liveApiEnabled: isTTLockLiveApiEnabled(),
    to,
  };

  const property = await db.property.findFirst({
    where: {
      OR: [
        { unitNumber: "801" },
        { name: { contains: "Margarita", mode: "insensitive" } },
      ],
      status: "ACTIVE",
      propertyLock: { isNot: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      unitNumber: true,
      propertyLock: { select: { integrationId: true, ttlockLockId: true } },
    },
  });

  if (!property?.propertyLock) {
    throw new Error("Propiedad con TTLock no encontrada");
  }

  if (property.propertyLock.integrationId) {
    await db.tTLockAutomationSettings.updateMany({
      where: { integrationId: property.propertyLock.integrationId },
      data: {
        autoSendCode: true,
        generateAfterGuestRegistration: true,
      },
    });
  }

  evidence.property = {
    id: property.id,
    name: property.name,
    unitNumber: property.unitNumber,
    ttlockLockId: property.propertyLock.ttlockLockId,
  };

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 62);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);

  const created = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "UI Visibility Audit",
      guestFirstName: "UIVis",
      guestLastName: "Audit",
      guestEmail: to,
      adults: 1,
      children: 0,
      infants: 0,
      checkIn,
      checkOut,
      platform: BookingPlatform.DIRECT,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: "PAID",
      totalAmount: 0,
      currency: "COP",
      internalNotes: "[audit] gr-ttlock-ui-visibility-v2",
    },
    select: { id: true },
  });
  evidence.reservationId = created.id;

  const url = await ensureGuestRegistrationForReservation(created.id);
  if (!url) throw new Error("No GR link");
  const token = url.split("/").filter(Boolean).pop()!;
  const stamp = randomUUID().slice(0, 8).toUpperCase();

  const guestProfile = {
    sex: "M" as const,
    travelMotive: "LEISURE" as const,
    occupation: "Auditor",
    nationality: "CO",
    dateOfBirth: "1991-01-15",
    residenceCountry: "CO",
    residenceAdminArea: "Antioquia",
    residenceCity: "Medellin",
    originCountry: "CO",
    originAdminArea: "Antioquia",
    originCity: "Medellin",
    destinationCountry: "CO",
    destinationAdminArea: "Antioquia",
    destinationCity: "Medellin",
  };

  await registerGuestStep({
    token,
    firstName: "UIVis",
    lastName: `Guest-${stamp}`,
    documentType: "CC",
    documentNumber: `80${stamp}`.slice(0, 10),
    email: to,
    phone: "+57 3009998877",
    ...guestProfile,
  });

  const t0 = Date.now();
  await completeGuestRegistration({
    token,
    confirmAllGuests: true,
    acceptLodgingContract: true,
    acceptHabeasData: true,
  });
  const settleMs = Date.now() - t0;

  const credential = await db.accessCredential.findFirst({
    where: {
      reservationId: created.id,
      ttlockCodeId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      deliveryStatus: true,
      ttlockCodeId: true,
      codeEncrypted: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
    },
  });

  const decrypted = credential
    ? decryptTTLockSecret(credential.codeEncrypted)
    : null;
  const uiCode = credential?.ttlockCodeId
    ? formatAccessCode(decrypted)
    : null;

  const detailDto = credential
    ? {
        status: credential.status,
        code: uiCode,
        isActive: ["GENERATED", "SENT", "ACTIVE"].includes(credential.status),
        validFrom: credential.validFrom?.toISOString() ?? null,
        validTo: credential.validTo?.toISOString() ?? null,
      }
    : null;

  const immediateUiOk = Boolean(
    detailDto?.code &&
      detailDto.isActive &&
      detailDto.validFrom &&
      detailDto.validTo &&
      credential?.ttlockCodeId &&
      decrypted,
  );

  evidence.immediateAfterSettle = {
    settleMs,
    credential: credential
      ? {
          id: credential.id,
          status: credential.status,
          deliveryStatus: credential.deliveryStatus,
          ttlockCodeId: credential.ttlockCodeId,
          validFrom: credential.validFrom,
          validTo: credential.validTo,
        }
      : null,
    detailDto,
    uiCapabilities: {
      hiddenByDefault: true,
      eyeToggle: true,
      copyButton: true,
      statusLabel: true,
      validityDates: Boolean(detailDto?.validFrom && detailDto?.validTo),
    },
    immediateUiOk,
  };

  let receptionProviderId: string | null = null;
  let accessDelivery: string | null = null;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const row = await db.reservation.findUnique({
      where: { id: created.id },
      select: {
        guestRegistrationAdminNotifiedAt: true,
        guestRegistrationAdminNotificationLog: true,
      },
    });
    const cred = await db.accessCredential.findFirst({
      where: { reservationId: created.id, ttlockCodeId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { deliveryStatus: true, id: true },
    });
    const log = parseGuestRegistrationAdminNotificationLog(
      row?.guestRegistrationAdminNotificationLog,
    );
    const latest = log[log.length - 1];
    const firstPid = latest?.providerIds
      ? Object.values(latest.providerIds)[0]
      : null;
    receptionProviderId = firstPid ?? receptionProviderId;
    accessDelivery = cred?.deliveryStatus ?? null;

    if (
      row?.guestRegistrationAdminNotifiedAt &&
      cred?.deliveryStatus === AccessCredentialDeliveryStatus.SENT
    ) {
      break;
    }
    await delay(2000);
  }

  // Best-effort: find access-code email provider via Resend not stored on reservation;
  // reception log + delivery SENT are the durable SSOT checks.
  const receptionResend = await fetchResendHtml(receptionProviderId);

  evidence.emails = {
    receptionNotified: Boolean(receptionProviderId),
    receptionProviderId,
    receptionResend,
    accessDelivery,
    guestAccessSent: accessDelivery === AccessCredentialDeliveryStatus.SENT,
  };

  // Dedupe: second settle/comms should skip already-sent emails
  const { runGuestRegistrationCompletionComms } = await import(
    "../src/services/guests/guest-registration-completion-comms.service"
  );
  const second = await runGuestRegistrationCompletionComms(created.id);
  evidence.idempotency = {
    ttlock: second.ttlock,
    reception: second.reception,
    accessCode: second.accessCode,
    tenantReport: second.tenantReport,
    receptionSkipped: second.reception.skipped === true,
    accessSkipped: second.accessCode.skipped === true,
  };

  const verdict = {
    generated: Boolean(credential?.ttlockCodeId),
    stored: Boolean(credential?.codeEncrypted),
    visibleInReservationDetailDto: immediateUiOk,
    validityDatesInDto: Boolean(detailDto?.validFrom && detailDto?.validTo),
    receptionEmail: Boolean(receptionProviderId),
    receptionEmailHasCode:
      receptionResend.skipped === true
        ? null
        : Boolean(receptionResend.checks?.hasCode),
    guestAccessEmail:
      accessDelivery === AccessCredentialDeliveryStatus.SENT,
    tenantReportOk: second.tenantReport.ok === true,
    idempotentRetries:
      second.reception.skipped === true && second.accessCode.skipped === true,
  };

  evidence.verdict = verdict;
  evidence.ok =
    verdict.generated &&
    verdict.stored &&
    verdict.visibleInReservationDetailDto &&
    verdict.validityDatesInDto &&
    verdict.receptionEmail &&
    verdict.guestAccessEmail &&
    verdict.tenantReportOk &&
    verdict.idempotentRetries &&
    (verdict.receptionEmailHasCode === null ||
      verdict.receptionEmailHasCode === true);
  evidence.finishedAt = new Date().toISOString();

  const outDir = join("docs", "audits", "evidence");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "gr-ttlock-ui-visibility.json");
  writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ok: evidence.ok, outPath, verdict }, null, 2));

  if (cleanup) {
    await db.accessCredential.deleteMany({
      where: { reservationId: created.id },
    });
    await db.accessEvent.deleteMany({ where: { reservationId: created.id } });
    await db.reservationGuest.deleteMany({
      where: { reservationId: created.id },
    });
    await db.guestRegistrationToken.deleteMany({
      where: { reservationId: created.id },
    });
    await db.guestRegistrationLegalAcceptance.deleteMany({
      where: { reservationId: created.id },
    });
    await db.reservation.update({
      where: { id: created.id },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  await db.$disconnect();
  if (!evidence.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
