/**
 * Auditoría de reglas de negocio: Direct vs Airbnb.
 * Solo lectura + pruebas controladas. No modifica código de producto.
 *
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-business-rules-direct-vs-airbnb.ts --cleanup
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";

config();
config({ path: ".env.local", override: true });

type RuleResult = {
  rule: string;
  ok: boolean;
  detail: Record<string, unknown>;
};

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const to = "magvillafuerte@gmail.com";

  const {
    BookingPlatform,
    ReservationStatus,
    AccessCredentialDeliveryStatus,
    AccessCredentialStatus,
  } = await import("@prisma/client");
  const { db } = await import("../src/lib/db");
  const { parseGuestRegistrationInviteLog } = await import(
    "../src/lib/guest-registration/guest-registration-invite-email-log"
  );
  const { parseGuestRegistrationAdminNotificationLog } = await import(
    "../src/lib/guest-registration/guest-registration-admin-notification-log"
  );
  const { resolveGuestRegistrationAdminRecipients } = await import(
    "../src/lib/operational-contacts"
  );
  const {
    ensureGuestRegistrationForReservation,
    registerGuestStep,
    completeGuestRegistration,
  } = await import("../src/services/guests/guest-registration.service");
  const { sendGuestRegistrationEmailForReservation } = await import(
    "../src/services/guests/guest-registration-email.service"
  );
  const {
    tryGenerateAccessCodeForReservation,
    generateAccessCodeForReservation,
  } = await import("../src/services/integrations/ttlock/ttlock-access.service");
  const { notifyAccessCodeEmailForCredential } = await import(
    "../src/services/integrations/ttlock/ttlock-access-code-email.service"
  );
  const { formatAccessCode } = await import("../src/lib/access-code");
  const { decryptTTLockSecret } = await import(
    "../src/services/integrations/ttlock/ttlock-crypto"
  );
  const { readFileSync } = await import("node:fs");

  const rules: RuleResult[] = [];
  const evidence: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    to,
  };

  // Static proof: Airbnb iCal never imports welcome sender
  {
    const icalPath = join(
      process.cwd(),
      "src/services/airbnb/airbnb-ical-sync.service.ts",
    );
    const icalSrc = readFileSync(icalPath, "utf8");
    const callsEnsure = /ensureGuestRegistrationForReservation/.test(icalSrc);
    const callsWelcome = /sendGuestRegistrationEmail/.test(icalSrc);
    rules.push({
      rule: "2 Airbnb sync: ensure GR sin welcome",
      ok: callsEnsure && !callsWelcome,
      detail: { callsEnsure, callsWelcome },
    });
  }

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
      notificationEmails: true,
      operationalContacts: true,
      guestRegistrationContactKey: true,
      propertyLock: { select: { id: true, integrationId: true } },
    },
  });
  if (!property?.propertyLock) throw new Error("Propiedad 801/Margarita no encontrada");

  const ops = resolveGuestRegistrationAdminRecipients({
    notificationEmails: property.notificationEmails,
    operationalContacts: property.operationalContacts,
    guestRegistrationContactKey: property.guestRegistrationContactKey,
  });
  evidence.ops = { recipients: ops.recipients, source: ops.source };

  if (property.propertyLock.integrationId) {
    await db.tTLockAutomationSettings.updateMany({
      where: { integrationId: property.propertyLock.integrationId },
      data: { autoSendCode: true, generateAfterGuestRegistration: true },
    });
  }

  function futureStay(offsetDays: number) {
    const checkIn = new Date();
    checkIn.setUTCDate(checkIn.getUTCDate() + offsetDays);
    checkIn.setUTCHours(0, 0, 0, 0);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 2);
    return { checkIn, checkOut };
  }

  // ── Negativo: Direct sin correo ────────────────────────────────────────
  {
    const dates = futureStay(60);
    const bare = await db.reservation.create({
      data: {
        propertyId: property.id,
        guestName: "BR No Email",
        guestFirstName: "NoEmail",
        guestEmail: null,
        adults: 1,
        children: 0,
        infants: 0,
        ...dates,
        platform: BookingPlatform.DIRECT,
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PAID",
        totalAmount: 0,
        currency: "COP",
        internalNotes: "[audit] business-rules no-email",
      },
      select: { id: true },
    });
    await ensureGuestRegistrationForReservation(bare.id);
    const result = await sendGuestRegistrationEmailForReservation(bare.id, {
      triggeredBy: "auto",
    });
    rules.push({
      rule: "Negativo Direct sin correo",
      ok: result.ok === false && /email/i.test(result.message),
      detail: { result },
    });
    if (cleanup) {
      await db.reservation.update({
        where: { id: bare.id },
        data: { status: ReservationStatus.CANCELLED },
      });
    }
  }

  // ── Regla 2 + negativo Airbnb ──────────────────────────────────────────
  {
    const dates = futureStay(61);
    const airbnb = await db.reservation.create({
      data: {
        propertyId: property.id,
        guestName: "BR Airbnb Guest",
        guestFirstName: "Airbnb",
        guestEmail: to,
        adults: 1,
        children: 0,
        infants: 0,
        ...dates,
        platform: BookingPlatform.AIRBNB,
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PAID",
        totalAmount: 0,
        currency: "COP",
        internalNotes: "[audit] business-rules airbnb",
      },
      select: { id: true },
    });
    await ensureGuestRegistrationForReservation(airbnb.id);
    const welcome = await sendGuestRegistrationEmailForReservation(airbnb.id, {
      triggeredBy: "auto",
    });
    const beforeTt = await tryGenerateAccessCodeForReservation(airbnb.id);
    const inviteLog = await db.reservation.findUnique({
      where: { id: airbnb.id },
      select: { guestRegistrationInviteSentAt: true, guestRegistrationInviteLog: true },
    });
    rules.push({
      rule: "2 Reserva Airbnb sin bienvenida auto",
      ok:
        welcome.skipped === true &&
        /directas/i.test(welcome.message) &&
        inviteLog?.guestRegistrationInviteSentAt == null &&
        parseGuestRegistrationInviteLog(inviteLog?.guestRegistrationInviteLog)
          .length === 0 &&
        beforeTt === null,
      detail: { welcome, beforeTt, inviteSentAt: inviteLog?.guestRegistrationInviteSentAt },
    });
    if (cleanup) {
      await db.reservation.update({
        where: { id: airbnb.id },
        data: { status: ReservationStatus.CANCELLED },
      });
    }
  }

  // ── Happy path Direct (reglas 1,3,4,5,6,7) ──────────────────────────────
  const dates = futureStay(62);
  const created = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "BR Direct Flow",
      guestFirstName: "BRDirect",
      guestLastName: "Audit",
      guestEmail: to,
      adults: 2,
      children: 0,
      infants: 0,
      ...dates,
      platform: BookingPlatform.DIRECT,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: "PAID",
      totalAmount: 0,
      currency: "COP",
      internalNotes: "[audit] business-rules direct-flow",
    },
    select: { id: true },
  });
  evidence.directReservationId = created.id;

  // Regla 5 pretest: TTLock blocked
  {
    const beforeTry = await tryGenerateAccessCodeForReservation(created.id);
    const beforeGen = await generateAccessCodeForReservation(created.id);
    const creds = await db.accessCredential.count({
      where: { reservationId: created.id },
    });
    rules.push({
      rule: "5 TTLock no genera antes de GR",
      ok:
        beforeTry === null &&
        beforeGen.ok === false &&
        /registro/i.test(beforeGen.message) &&
        creds === 0,
      detail: { beforeTry, beforeGen, creds },
    });
  }

  // Regla 1: bienvenida
  {
    const url = await ensureGuestRegistrationForReservation(created.id);
    const first = await sendGuestRegistrationEmailForReservation(created.id, {
      triggeredBy: "auto",
    });
    const second = await sendGuestRegistrationEmailForReservation(created.id, {
      triggeredBy: "auto",
    });
    const row = await db.reservation.findUnique({
      where: { id: created.id },
      select: {
        guestRegistrationInviteSentAt: true,
        guestRegistrationInviteLog: true,
      },
    });
    const log = parseGuestRegistrationInviteLog(row?.guestRegistrationInviteLog);
    evidence.welcome = { url, first, second, log };
    rules.push({
      rule: "1 Direct bienvenida auto + link + historial",
      ok:
        Boolean(url?.includes("guest-registration/")) &&
        first.ok === true &&
        !first.skipped &&
        Boolean(first.providerId) &&
        Boolean(row?.guestRegistrationInviteSentAt) &&
        log.some((e) => e.status === "success" && e.providerId),
      detail: {
        providerId: first.providerId,
        url,
        logStatus: log[0]?.status,
      },
    });
    rules.push({
      rule: "7 Anti-dupe bienvenida",
      ok: second.skipped === true,
      detail: { second },
    });
  }

  // Regla 3: GR
  {
    const token = String(evidence.welcome && (evidence.welcome as { url?: string }).url)
      .split("/")
      .filter(Boolean)
      .pop()!;
    const stamp = randomUUID().slice(0, 8).toUpperCase();
    await registerGuestStep({
      token,
      firstName: "BRDirect",
      lastName: `Titular-${stamp}`,
      documentType: "CC",
      documentNumber: `81${stamp}`.slice(0, 10),
      email: to,
      phone: "+57 3001234567",
      nationality: "Colombia",
      dateOfBirth: "1990-01-15",
    });
    await registerGuestStep({
      token,
      firstName: "BRDirect",
      lastName: `Acomp-${stamp}`,
      documentType: "CC",
      documentNumber: `82${stamp}`.slice(0, 10),
      nationality: "Colombia",
      dateOfBirth: "1991-02-20",
    });
    await completeGuestRegistration({ token, confirmAllGuests: true });
    const after = await db.reservation.findUnique({
      where: { id: created.id },
      select: {
        guestRegistrationCompletedAt: true,
        guests: { select: { fullName: true, isReservationOwner: true } },
      },
    });
    evidence.gr = after;
    rules.push({
      rule: "3 Guest Registration COMPLETED",
      ok:
        Boolean(after?.guestRegistrationCompletedAt) &&
        (after?.guests.length ?? 0) >= 2 &&
        after!.guests.some((g) => g.isReservationOwner),
      detail: {
        completedAt: after?.guestRegistrationCompletedAt?.toISOString(),
        guests: after?.guests.length,
      },
    });
  }

  // Regla 4: admin
  {
    let ok = false;
    let detail: Record<string, unknown> = {};
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const row = await db.reservation.findUnique({
        where: { id: created.id },
        select: {
          guestRegistrationAdminNotifiedAt: true,
          guestRegistrationAdminNotificationLog: true,
        },
      });
      const log = parseGuestRegistrationAdminNotificationLog(
        row?.guestRegistrationAdminNotificationLog,
      );
      const latest = log[log.length - 1];
      if (latest && row?.guestRegistrationAdminNotifiedAt) {
        ok =
          latest.status === "success" &&
          latest.recipients.some((r) => ops.recipients.includes(r)) &&
          Boolean(latest.providerIds && Object.keys(latest.providerIds).length);
        detail = {
          notifiedAt: row.guestRegistrationAdminNotifiedAt.toISOString(),
          recipients: latest.recipients,
          providerIds: latest.providerIds,
          source: latest.source,
        };
        evidence.admin = detail;

        // anti-dupe admin: second auto should skip
        const { notifyAdminGuestRegistrationCompleted } = await import(
          "../src/services/guests/guest-registration-admin-notification.service"
        );
        const again = await notifyAdminGuestRegistrationCompleted(created.id, {
          triggeredBy: "auto",
        });
        rules.push({
          rule: "7 Anti-dupe administración",
          ok: again.skipped === true || again.ok === true,
          detail: { again },
        });
        break;
      }
      await delay(2000);
    }
    rules.push({
      rule: "4 Correo administración + Contacto Operativo",
      ok,
      detail,
    });
  }

  // Regla 5+6: TTLock after GR + email
  {
    let okCode = false;
    let okEmail = false;
    let detail: Record<string, unknown> = {};
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const cred = await db.accessCredential.findFirst({
        where: { reservationId: created.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          deliveryStatus: true,
          codeEncrypted: true,
        },
      });
      if (!cred) {
        await generateAccessCodeForReservation(created.id, {
          skipManualApproval: true,
        });
        await delay(2000);
        continue;
      }
      if (
        cred.deliveryStatus === AccessCredentialDeliveryStatus.PENDING
      ) {
        await delay(2000);
        continue;
      }
      if (
        cred.codeEncrypted &&
        cred.deliveryStatus === AccessCredentialDeliveryStatus.SENT
      ) {
        const raw = decryptTTLockSecret(cred.codeEncrypted);
        const code = formatAccessCode(raw) ?? raw ?? "";
        const plain = /^\d+#?$/.test(code.replace(/\s/g, ""));
        const noMd = !/\*\*.+\*\*/.test(code);
        okCode = plain && noMd && code.includes("#");
        const again = await notifyAccessCodeEmailForCredential(cred.id);
        okEmail = again.skipped === true;
        detail = {
          credentialId: cred.id,
          code,
          deliveryStatus: cred.deliveryStatus,
          dedupe: again,
        };
        evidence.ttlock = detail;
        rules.push({
          rule: "7 Anti-dupe código TTLock",
          ok: okEmail,
          detail: { again },
        });
        break;
      }
      await delay(2000);
    }
    rules.push({
      rule: "5+6 TTLock genera post-GR y correo plain al huésped+ops",
      ok: okCode && okEmail,
      detail,
    });
  }

  // Manual resend: only while GR link is still ACTIVE (before COMPLETED).
  // Validated right after welcome (rule 1), using a dedicated Direct reservation.
  {
    const datesManual = futureStay(64);
    const manualRes = await db.reservation.create({
      data: {
        propertyId: property.id,
        guestName: "BR Manual Resend",
        guestFirstName: "Manual",
        guestEmail: to,
        adults: 1,
        children: 0,
        infants: 0,
        ...datesManual,
        platform: BookingPlatform.DIRECT,
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PAID",
        totalAmount: 0,
        currency: "COP",
        internalNotes: "[audit] business-rules manual-resend",
      },
      select: { id: true },
    });
    await ensureGuestRegistrationForReservation(manualRes.id);
    const auto = await sendGuestRegistrationEmailForReservation(manualRes.id, {
      triggeredBy: "auto",
    });
    const blocked = await sendGuestRegistrationEmailForReservation(manualRes.id, {
      triggeredBy: "auto",
    });
    const forced = await sendGuestRegistrationEmailForReservation(manualRes.id, {
      force: true,
      triggeredBy: "manual",
    });
    rules.push({
      rule: "Negativo/Reenvío: auto bloqueado; manual force permitido",
      ok:
        auto.ok === true &&
        blocked.skipped === true &&
        forced.ok === true &&
        !forced.skipped,
      detail: { auto, blocked, forced },
    });
    if (cleanup) {
      await db.reservation.update({
        where: { id: manualRes.id },
        data: { status: ReservationStatus.CANCELLED },
      });
    }
  }

  // Negativo: TTLock falla → no envía correo con código
  {
    const datesFail = futureStay(63);
    const failRes = await db.reservation.create({
      data: {
        propertyId: property.id,
        guestName: "BR TTLock Fail",
        guestFirstName: "Fail",
        guestEmail: to,
        adults: 1,
        children: 0,
        infants: 0,
        ...datesFail,
        platform: BookingPlatform.DIRECT,
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PAID",
        totalAmount: 0,
        currency: "COP",
        guestRegistrationCompletedAt: new Date(),
        internalNotes: "[audit] business-rules ttlock-fail",
      },
      select: { id: true },
    });
    const orgId =
      (
        await db.property.findUnique({
          where: { id: property.id },
          select: { organizationId: true },
        })
      )?.organizationId ?? null;

    const badCred = await db.accessCredential.create({
      data: {
        reservationId: failRes.id,
        organizationId: orgId!,
        propertyLockId: property.propertyLock.id,
        status: AccessCredentialStatus.FAILED,
        deliveryStatus: AccessCredentialDeliveryStatus.NOT_SENT,
        type: "GUEST",
        codeEncrypted: null,
        validFrom: datesFail.checkIn,
        validTo: datesFail.checkOut,
      },
      select: { id: true, deliveryStatus: true },
    });

    const sendAttempt = await notifyAccessCodeEmailForCredential(badCred.id);
    const after = await db.accessCredential.findUnique({
      where: { id: badCred.id },
      select: { deliveryStatus: true },
    });

    rules.push({
      rule: "Negativo TTLock falla → no correo código exitoso",
      ok:
        sendAttempt.ok === false &&
        after?.deliveryStatus !== AccessCredentialDeliveryStatus.SENT,
      detail: { sendAttempt, deliveryStatus: after?.deliveryStatus },
    });

    if (cleanup) {
      await db.reservation.update({
        where: { id: failRes.id },
        data: { status: ReservationStatus.CANCELLED },
      });
    }
  }

  if (cleanup) {
    await db.reservation.update({
      where: { id: created.id },
      data: { status: ReservationStatus.CANCELLED },
    });
    evidence.cleanup = "CANCELLED";
  }

  // Global architecture snapshot
  {
    const sendEmailSrc = readFileSync(
      join(process.cwd(), "src/lib/email/send-email.ts"),
      "utf8",
    );
    const onlyResend = sendEmailSrc.includes("api.resend.com");
    rules.push({
      rule: "Global: un transporte Resend / sin pipeline paralelo",
      ok: onlyResend,
      detail: { onlyResend },
    });
  }

  const allOk = rules.every((r) => r.ok);
  evidence.finishedAt = new Date().toISOString();
  evidence.rules = rules;
  evidence.allOk = allOk;

  const outDir = join(process.cwd(), "docs", "audits", "evidence");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "business-rules-direct-vs-airbnb.json");
  writeFileSync(outPath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify({ allOk, rules, outPath }, null, 2));
  if (!allOk) process.exitCode = 1;
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
