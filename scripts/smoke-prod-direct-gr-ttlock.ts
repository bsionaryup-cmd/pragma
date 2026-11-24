/**
 * Smoke test post-deploy definitivo (Direct → welcome → GR → TTLock gate).
 *
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/smoke-prod-direct-gr-ttlock.ts --cleanup
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";

config();
config({ path: ".env.local", override: true });

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const to = "magvillafuerte@gmail.com";

  const {
    BookingPlatform,
    ReservationStatus,
    AccessCredentialDeliveryStatus,
  } = await import("@prisma/client");
  const { db } = await import("../src/lib/db");
  const { parseGuestRegistrationInviteLog } = await import(
    "../src/lib/guest-registration/guest-registration-invite-email-log"
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
  const { formatAccessCode } = await import("../src/lib/access-code");
  const { decryptTTLockSecret } = await import(
    "../src/services/integrations/ttlock/ttlock-crypto"
  );

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
      propertyLock: { select: { integrationId: true } },
    },
  });
  if (!property) throw new Error("Propiedad 801 no encontrada");

  if (property.propertyLock?.integrationId) {
    await db.tTLockAutomationSettings.updateMany({
      where: { integrationId: property.propertyLock.integrationId },
      data: { autoSendCode: true, generateAfterGuestRegistration: true },
    });
  }

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 70);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);

  const created = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "Prod Smoke Direct",
      guestFirstName: "ProdSmoke",
      guestLastName: "Direct",
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
      internalNotes: "[smoke] definitive-deploy-freeze",
    },
    select: { id: true },
  });

  const checks: Record<string, unknown> = {
    reservationId: created.id,
    property: property.unitNumber ?? property.name,
  };

  // TTLock before GR must fail
  const beforeTt = await tryGenerateAccessCodeForReservation(created.id);
  const beforeGen = await generateAccessCodeForReservation(created.id);
  checks.ttlockBeforeGr = {
    try: beforeTt,
    generate: beforeGen,
    pass: beforeTt === null && beforeGen.ok === false,
  };

  const url = await ensureGuestRegistrationForReservation(created.id);
  const welcome = await sendGuestRegistrationEmailForReservation(created.id, {
    triggeredBy: "auto",
  });
  const welcomeDedupe = await sendGuestRegistrationEmailForReservation(
    created.id,
    { triggeredBy: "auto" },
  );
  const inviteRow = await db.reservation.findUnique({
    where: { id: created.id },
    select: {
      guestRegistrationInviteSentAt: true,
      guestRegistrationInviteLog: true,
    },
  });
  const inviteLog = parseGuestRegistrationInviteLog(
    inviteRow?.guestRegistrationInviteLog,
  );
  checks.welcome = {
    url,
    welcome,
    welcomeDedupe,
    log: inviteLog,
    pass:
      Boolean(url?.includes("guest-registration/")) &&
      welcome.ok === true &&
      Boolean(welcome.providerId) &&
      welcomeDedupe.skipped === true &&
      inviteLog.some((e) => e.status === "success"),
  };

  const token = url!.split("/").filter(Boolean).pop()!;
  const stamp = randomUUID().slice(0, 6).toUpperCase();
  await registerGuestStep({
    token,
    firstName: "ProdSmoke",
    lastName: `Guest-${stamp}`,
    documentType: "CC",
    documentNumber: `70${stamp}`.slice(0, 10),
    email: to,
    phone: "+57 3009998877",
    nationality: "Colombia",
    dateOfBirth: "1988-05-01",
  });
  await completeGuestRegistration({ token, confirmAllGuests: true });

  const afterGr = await db.reservation.findUnique({
    where: { id: created.id },
    select: { guestRegistrationCompletedAt: true },
  });
  checks.guestRegistration = {
    completedAt: afterGr?.guestRegistrationCompletedAt?.toISOString() ?? null,
    pass: Boolean(afterGr?.guestRegistrationCompletedAt),
  };

  let ttlockOk = false;
  let ttlockDetail: Record<string, unknown> = {};
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const cred = await db.accessCredential.findFirst({
      where: { reservationId: created.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        deliveryStatus: true,
        codeEncrypted: true,
        status: true,
      },
    });
    if (!cred) {
      await generateAccessCodeForReservation(created.id, {
        skipManualApproval: true,
      });
      await delay(2000);
      continue;
    }
    if (cred.deliveryStatus === AccessCredentialDeliveryStatus.PENDING) {
      await delay(2000);
      continue;
    }
    if (cred.codeEncrypted) {
      const code =
        formatAccessCode(decryptTTLockSecret(cred.codeEncrypted)) ??
        decryptTTLockSecret(cred.codeEncrypted);
      ttlockOk =
        Boolean(code) &&
        !/\*\*/.test(String(code)) &&
        Boolean(afterGr?.guestRegistrationCompletedAt);
      ttlockDetail = {
        credentialId: cred.id,
        code,
        deliveryStatus: cred.deliveryStatus,
        status: cred.status,
      };
      break;
    }
    await delay(2000);
  }
  checks.ttlockAfterGr = { ...ttlockDetail, pass: ttlockOk };

  const allPass = Boolean(
    (checks.ttlockBeforeGr as { pass?: boolean }).pass &&
      (checks.welcome as { pass?: boolean }).pass &&
      (checks.guestRegistration as { pass?: boolean }).pass &&
      (checks.ttlockAfterGr as { pass?: boolean }).pass,
  );

  if (cleanup) {
    await db.reservation.update({
      where: { id: created.id },
      data: { status: ReservationStatus.CANCELLED },
    });
    checks.cleanup = "CANCELLED";
  }

  const out = {
    startedAt: new Date().toISOString(),
    allPass,
    checks,
  };
  const outDir = join(process.cwd(), "docs", "audits", "evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "smoke-prod-definitive-deploy.json"),
    JSON.stringify(out, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(out, null, 2));
  if (!allPass) process.exitCode = 1;
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
