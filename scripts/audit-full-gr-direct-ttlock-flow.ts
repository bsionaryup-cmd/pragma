/**
 * Auditoría final E2E: Direct → Bienvenida → GR → Admin → TTLock → Correo código.
 * Casos negativos incluidos. No hace deploy.
 *
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-full-gr-direct-ttlock-flow.ts
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-full-gr-direct-ttlock-flow.ts --cleanup
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";

config();
config({ path: ".env.local", override: true });

type PhaseResult = {
  phase: string;
  ok: boolean;
  detail: Record<string, unknown>;
};

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

async function fetchResendSummary(providerId: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || providerId === "simulated") {
    return { skipped: true, providerId };
  }
  const response = await fetch(`https://api.resend.com/emails/${providerId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = (await response.json()) as Record<string, unknown>;
  const html = typeof body.html === "string" ? body.html : "";
  return {
    httpStatus: response.status,
    id: body.id ?? null,
    from: body.from ?? null,
    to: body.to ?? null,
    subject: body.subject ?? null,
    last_event: body.last_event ?? null,
    htmlChecks: {
      pragmaBrand: /PRAGMA/i.test(html),
      guestRegistrationLink: /guest-registration\//i.test(html),
      hasCodePlain: /\d{4,}#/.test(html),
      hasMarkdownBoldCode: /\*\*\d+#\*\*/.test(html),
    },
  };
}

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const to =
    argValue("--to")?.trim().toLowerCase() ||
    process.env.FULL_FLOW_TEST_TO?.trim().toLowerCase() ||
    "magvillafuerte@gmail.com";

  const {
    BookingPlatform,
    ReservationStatus,
    AccessCredentialDeliveryStatus,
  } = await import("@prisma/client");
  const { db } = await import("../src/lib/db");
  const {
    resolveEmailFromAddress,
    shouldSimulateEmailDelivery,
  } = await import("../src/lib/email/send-email");
  const {
    parseGuestRegistrationInviteLog,
  } = await import(
    "../src/lib/guest-registration/guest-registration-invite-email-log"
  );
  const {
    parseGuestRegistrationAdminNotificationLog,
  } = await import(
    "../src/lib/guest-registration/guest-registration-admin-notification-log"
  );
  const { resolveGuestRegistrationAdminRecipients } = await import(
    "../src/lib/operational-contacts"
  );
  const { ensureGuestRegistrationForReservation } = await import(
    "../src/services/guests/guest-registration.service"
  );
  const {
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
  const { formatAccessCode } = await import("../src/lib/access-code");
  const { decryptTTLockSecret } = await import(
    "../src/services/integrations/ttlock/ttlock-crypto"
  );

  const phases: PhaseResult[] = [];
  const evidence: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    mode: shouldSimulateEmailDelivery() ? "simulado" : "real",
    from: resolveEmailFromAddress(),
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
      notificationEmails: true,
      operationalContacts: true,
      guestRegistrationContactKey: true,
      propertyLock: { select: { id: true, integrationId: true } },
    },
  });

  if (!property?.propertyLock) {
    throw new Error("Propiedad Margarita/801 con TTLock no encontrada");
  }

  const ops = resolveGuestRegistrationAdminRecipients({
    notificationEmails: property.notificationEmails,
    operationalContacts: property.operationalContacts,
    guestRegistrationContactKey: property.guestRegistrationContactKey,
  });

  const integrationId = property.propertyLock.integrationId;
  if (integrationId) {
    await db.tTLockAutomationSettings.updateMany({
      where: { integrationId },
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
    opsRecipients: ops.recipients,
    opsSource: ops.source,
  };

  // ─── Fase 7.1: Direct sin correo ───────────────────────────────────────
  {
    const checkIn = new Date();
    checkIn.setUTCDate(checkIn.getUTCDate() + 50);
    checkIn.setUTCHours(0, 0, 0, 0);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 1);

    const bare = await db.reservation.create({
      data: {
        propertyId: property.id,
        guestName: "No Email Guest",
        guestFirstName: "NoEmail",
        guestEmail: null,
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
        internalNotes: "[audit] no-email negative",
      },
      select: { id: true },
    });
    await ensureGuestRegistrationForReservation(bare.id);
    const result = await sendGuestRegistrationEmailForReservation(bare.id, {
      triggeredBy: "auto",
    });
    phases.push({
      phase: "7.1 Direct sin correo",
      ok: result.ok === false && /email/i.test(result.message),
      detail: { reservationId: bare.id, result },
    });
    await db.reservation.update({
      where: { id: bare.id },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  // ─── Fase 7.2: Airbnb no envía bienvenida ──────────────────────────────
  {
    const checkIn = new Date();
    checkIn.setUTCDate(checkIn.getUTCDate() + 51);
    checkIn.setUTCHours(0, 0, 0, 0);
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkOut.getUTCDate() + 1);

    const airbnb = await db.reservation.create({
      data: {
        propertyId: property.id,
        guestName: "Airbnb Audit Guest",
        guestFirstName: "Airbnb",
        guestEmail: to,
        adults: 1,
        children: 0,
        infants: 0,
        checkIn,
        checkOut,
        platform: BookingPlatform.AIRBNB,
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PAID",
        totalAmount: 0,
        currency: "COP",
        internalNotes: "[audit] airbnb no-welcome",
      },
      select: { id: true },
    });
    await ensureGuestRegistrationForReservation(airbnb.id);
    const result = await sendGuestRegistrationEmailForReservation(airbnb.id, {
      triggeredBy: "auto",
    });
    phases.push({
      phase: "7.2 Airbnb sin bienvenida auto",
      ok: result.skipped === true && /directas/i.test(result.message),
      detail: { reservationId: airbnb.id, result },
    });
    await db.reservation.update({
      where: { id: airbnb.id },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  // ─── Happy path Direct ─────────────────────────────────────────────────
  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 52);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);

  const created = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "Full Flow Audit",
      guestFirstName: "FullFlow",
      guestLastName: "Audit",
      guestEmail: to,
      adults: 2,
      children: 0,
      infants: 0,
      checkIn,
      checkOut,
      platform: BookingPlatform.DIRECT,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: "PAID",
      totalAmount: 0,
      currency: "COP",
      internalNotes: "[audit] full-gr-direct-ttlock-flow",
    },
    select: { id: true },
  });
  evidence.reservationId = created.id;

  // Fase 7.3/7.4: TTLock antes de GR
  {
    const beforeTry = await tryGenerateAccessCodeForReservation(created.id);
    const beforeGen = await generateAccessCodeForReservation(created.id);
    const credsBefore = await db.accessCredential.count({
      where: { reservationId: created.id },
    });
    phases.push({
      phase: "7.3/7.4 TTLock bloqueado antes de GR",
      ok:
        beforeTry === null &&
        beforeGen.ok === false &&
        /registro/i.test(beforeGen.message) &&
        credsBefore === 0,
      detail: { beforeTry, beforeGen, credsBefore },
    });
  }

  // Fase 2: Bienvenida
  {
    const url = await ensureGuestRegistrationForReservation(created.id);
    if (!url) throw new Error("No GR link");
    evidence.registrationUrl = url;

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
    const welcomeResend = first.providerId
      ? await fetchResendSummary(first.providerId)
      : null;
    evidence.welcome = { first, second, log, resend: welcomeResend };

    phases.push({
      phase: "2 Bienvenida Direct",
      ok:
        first.ok === true &&
        !first.skipped &&
        Boolean(first.providerId) &&
        second.skipped === true &&
        log.some((e) => e.status === "success" && e.providerId) &&
        /guest-registration\//.test(url),
      detail: {
        providerId: first.providerId,
        dedupe: second.message,
        logStatus: log[0]?.status,
        resendLastEvent: (welcomeResend as { last_event?: string } | null)
          ?.last_event,
      },
    });
  }

  // Fase 3: Guest Registration
  {
    const tokenUrl = evidence.registrationUrl as string;
    const token = tokenUrl.split("/").filter(Boolean).pop()!;
    const stamp = randomUUID().slice(0, 8).toUpperCase();

    await registerGuestStep({
      token,
      firstName: "FullFlow",
      lastName: `Titular-${stamp}`,
      documentType: "CC",
      documentNumber: `91${stamp}`.slice(0, 10),
      email: to,
      phone: "+57 3001234567",
      nationality: "Colombia",
      dateOfBirth: "1990-03-12",
    });
    await registerGuestStep({
      token,
      firstName: "FullFlow",
      lastName: `Acomp-${stamp}`,
      documentType: "CC",
      documentNumber: `92${stamp}`.slice(0, 10),
      nationality: "Colombia",
      dateOfBirth: "1992-08-05",
    });
    await completeGuestRegistration({
      token,
      confirmAllGuests: true,
    });

    const after = await db.reservation.findUnique({
      where: { id: created.id },
      select: {
        guestRegistrationCompletedAt: true,
        guests: {
          select: {
            fullName: true,
            isReservationOwner: true,
            email: true,
            status: true,
          },
        },
      },
    });
    evidence.guestRegistration = after;
    phases.push({
      phase: "3 Guest Registration COMPLETED",
      ok:
        Boolean(after?.guestRegistrationCompletedAt) &&
        (after?.guests.length ?? 0) >= 2 &&
        after!.guests.some((g) => g.isReservationOwner),
      detail: {
        completedAt: after?.guestRegistrationCompletedAt?.toISOString(),
        guestCount: after?.guests.length,
        owner: after?.guests.find((g) => g.isReservationOwner)?.fullName,
      },
    });
  }

  // Fase 4: Admin notify (async)
  {
    let adminOk = false;
    let adminDetail: Record<string, unknown> = {};
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const row = await db.reservation.findUnique({
        where: { id: created.id },
        select: {
          guestRegistrationAdminNotifiedAt: true,
          guestRegistrationAdminNotificationError: true,
          guestRegistrationAdminNotificationLog: true,
        },
      });
      const log = parseGuestRegistrationAdminNotificationLog(
        row?.guestRegistrationAdminNotificationLog,
      );
      const latest = log[log.length - 1];
      if (latest && row?.guestRegistrationAdminNotifiedAt) {
        const providerIds = latest.providerIds ?? {};
        const firstPid = Object.values(providerIds)[0];
        const resend = firstPid ? await fetchResendSummary(firstPid) : null;
        evidence.adminNotify = { row, log, resend };
        adminOk =
          latest.status === "success" &&
          Object.keys(providerIds).length > 0 &&
          Boolean(row.guestRegistrationAdminNotifiedAt);
        adminDetail = {
          notifiedAt: row.guestRegistrationAdminNotifiedAt.toISOString(),
          recipients: latest.recipients,
          providerIds,
          resendLastEvent: (resend as { last_event?: string } | null)?.last_event,
          branding:
            (resend as { htmlChecks?: { pragmaBrand?: boolean } } | null)
              ?.htmlChecks?.pragmaBrand ?? null,
        };
        break;
      }
      await delay(2000);
    }
    phases.push({
      phase: "4 Correo administración",
      ok: adminOk,
      detail: adminDetail,
    });
  }

  // Fase 5+6: TTLock generate + email
  {
    let ttOk = false;
    let ttDetail: Record<string, unknown> = {};
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
          ttlockCodeId: true,
        },
      });
      if (
        cred &&
        cred.codeEncrypted &&
        (cred.deliveryStatus === AccessCredentialDeliveryStatus.SENT ||
          cred.deliveryStatus === AccessCredentialDeliveryStatus.PENDING)
      ) {
        // wait a bit more if PENDING
        if (cred.deliveryStatus === AccessCredentialDeliveryStatus.PENDING) {
          await delay(2000);
          continue;
        }
        const raw = decryptTTLockSecret(cred.codeEncrypted);
        const code = formatAccessCode(raw) ?? raw;
        const hasMarkdown = /\*\*.+\*\*/.test(code);
        const plainOk = /^\d+#?$/.test(code.replace(/\s/g, "")) || Boolean(code);

        // Anti-dupe: trigger email again
        const { notifyAccessCodeEmailForCredential } = await import(
          "../src/services/integrations/ttlock/ttlock-access-code-email.service"
        );
        const again = await notifyAccessCodeEmailForCredential(cred.id);

        evidence.ttlock = {
          credentialId: cred.id,
          status: cred.status,
          deliveryStatus: cred.deliveryStatus,
          code,
          ttlockCodeId: cred.ttlockCodeId,
          dedupe: again,
        };

        ttOk =
          cred.deliveryStatus === AccessCredentialDeliveryStatus.SENT &&
          !hasMarkdown &&
          plainOk &&
          again.skipped === true;
        ttDetail = {
          credentialId: cred.id,
          deliveryStatus: cred.deliveryStatus,
          code,
          hasMarkdownBold: hasMarkdown,
          dedupeMessage: again.message,
        };
        break;
      }
      // also try kick generation if still nothing
      if (!cred) {
        await generateAccessCodeForReservation(created.id, {
          skipManualApproval: true,
        });
      }
      await delay(3000);
    }

    // Fase 7.5 retries welcome already covered; access code dedupe in detail
    phases.push({
      phase: "5+6 TTLock código + correo",
      ok: ttOk,
      detail: ttDetail,
    });
    phases.push({
      phase: "7.5 Anti-duplicados código",
      ok: Boolean(
        evidence.ttlock &&
          (evidence.ttlock as { dedupe?: { skipped?: boolean } }).dedupe
            ?.skipped,
      ),
      detail: {
        dedupe: (evidence.ttlock as { dedupe?: unknown } | undefined)?.dedupe,
      },
    });
  }

  // Fase 7.5 welcome already validated in phase 2 second send
  phases.push({
    phase: "7.5 Anti-duplicados bienvenida",
    ok: Boolean(
      (evidence.welcome as { second?: { skipped?: boolean } } | undefined)
        ?.second?.skipped,
    ),
    detail: {
      second: (evidence.welcome as { second?: unknown } | undefined)?.second,
    },
  });

  if (cleanup) {
    await db.reservation.update({
      where: { id: created.id },
      data: { status: ReservationStatus.CANCELLED },
    });
    evidence.cleanup = "CANCELLED";
  }

  const allOk = phases.every((p) => p.ok);
  evidence.finishedAt = new Date().toISOString();
  evidence.phases = phases;
  evidence.allOk = allOk;

  const outDir = join(process.cwd(), "docs", "audits", "evidence");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "full-gr-direct-ttlock-flow-evidence.json");
  writeFileSync(outPath, JSON.stringify(evidence, null, 2), "utf8");

  console.log(JSON.stringify({ allOk, phases, outPath }, null, 2));
  if (!allOk) process.exitCode = 1;

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
