/**
 * Reproducción de duplicidad de correos al huésped.
 *
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-guest-email-duplication.ts --cleanup
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
    PaymentStatus,
    AccessCredentialDeliveryStatus,
  } = await import("@prisma/client");
  const { db } = await import("../src/lib/db");
  const { parseGuestRegistrationInviteLog } = await import(
    "../src/lib/guest-registration/guest-registration-invite-email-log"
  );
  const { parseGuestRegistrationAdminNotificationLog } = await import(
    "../src/lib/guest-registration/guest-registration-admin-notification-log"
  );
  const {
    ensureGuestRegistrationForReservation,
    registerGuestStep,
    completeGuestRegistration,
  } = await import("../src/services/guests/guest-registration.service");
  const { sendGuestRegistrationEmailForReservation } = await import(
    "../src/services/guests/guest-registration-email.service"
  );
  const { computeHoldExpiresAt } = await import(
    "../src/lib/reservations/reservation-hold"
  );
  const {
    generateAccessCodeForReservation,
  } = await import("../src/services/integrations/ttlock/ttlock-access.service");
  const { notifyAccessCodeEmailForCredential } = await import(
    "../src/services/integrations/ttlock/ttlock-access-code-email.service"
  );
  const { notifyAdminGuestRegistrationCompleted } = await import(
    "../src/services/guests/guest-registration-admin-notification.service"
  );

  const property = await db.property.findFirst({
    where: {
      unitNumber: "801",
      status: "ACTIVE",
      propertyLock: { isNot: null },
    },
    select: {
      id: true,
      propertyLock: { select: { integrationId: true } },
    },
  });
  if (!property?.propertyLock) throw new Error("801/TTLock missing");

  if (property.propertyLock.integrationId) {
    await db.tTLockAutomationSettings.updateMany({
      where: { integrationId: property.propertyLock.integrationId },
      data: { autoSendCode: true, generateAfterGuestRegistration: true },
    });
  }

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 90);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);

  // Simulate FIXED create: welcome THEN hold
  const reservation = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "Dupe Audit Guest",
      guestFirstName: "Dupe",
      guestLastName: "Audit",
      guestEmail: to,
      adults: 1,
      children: 0,
      infants: 0,
      checkIn,
      checkOut,
      platform: BookingPlatform.DIRECT,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PENDING,
      totalAmount: 200000,
      currency: "COP",
      internalNotes: "[audit] guest-email-duplication",
    },
    select: { id: true },
  });

  await ensureGuestRegistrationForReservation(reservation.id);
  const welcome1 = await sendGuestRegistrationEmailForReservation(
    reservation.id,
    { triggeredBy: "auto" },
  );

  await db.reservation.update({
    where: { id: reservation.id },
    data: { holdExpiresAt: computeHoldExpiresAt() },
  });

  // Simulate post-hold finalize (deposit met): clear hold + send again
  await db.reservation.update({
    where: { id: reservation.id },
    data: { holdExpiresAt: null, paymentStatus: PaymentStatus.PAID },
  });
  const welcome2 = await sendGuestRegistrationEmailForReservation(
    reservation.id,
    { triggeredBy: "auto" },
  );
  const welcome3 = await sendGuestRegistrationEmailForReservation(
    reservation.id,
    { triggeredBy: "auto" },
  );

  // Complete GR → TTLock
  const tokenRow = await db.guestRegistrationToken.findFirst({
    where: { reservationId: reservation.id, status: "ACTIVE" },
    select: { token: true },
  });
  const stamp = randomUUID().slice(0, 6).toUpperCase();
  await registerGuestStep({
    token: tokenRow!.token,
    firstName: "Dupe",
    lastName: `Audit-${stamp}`,
    documentType: "CC",
    documentNumber: `55${stamp}`.slice(0, 10),
    email: to,
    phone: "+57 3001112233",
    nationality: "Colombia",
    dateOfBirth: "1991-01-01",
  });
  await completeGuestRegistration({
    token: tokenRow!.token,
    confirmAllGuests: true,
  });

  // Wait admin + TTLock email
  await delay(8000);

  // Call generate again (existing credential path — schedules email again)
  const gen2 = await generateAccessCodeForReservation(reservation.id);
  await delay(3000);
  const gen3 = await generateAccessCodeForReservation(reservation.id);
  await delay(2000);

  const cred = await db.accessCredential.findFirst({
    where: { reservationId: reservation.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, deliveryStatus: true, status: true },
  });

  const emailAgain1 = cred
    ? await notifyAccessCodeEmailForCredential(cred.id)
    : null;
  const emailAgain2 = cred
    ? await notifyAccessCodeEmailForCredential(cred.id)
    : null;

  const adminAgain = await notifyAdminGuestRegistrationCompleted(reservation.id, {
    triggeredBy: "auto",
  });

  const row = await db.reservation.findUnique({
    where: { id: reservation.id },
    select: {
      guestRegistrationInviteLog: true,
      guestRegistrationAdminNotificationLog: true,
      guestRegistrationInviteSentAt: true,
      guestRegistrationAdminNotifiedAt: true,
    },
  });

  const inviteLog = parseGuestRegistrationInviteLog(
    row?.guestRegistrationInviteLog,
  );
  const adminLog = parseGuestRegistrationAdminNotificationLog(
    row?.guestRegistrationAdminNotificationLog,
  );
  const autoInvites = inviteLog.filter((e) => e.triggeredBy === "auto");
  const autoAdmins = adminLog.filter((e) => e.triggeredBy === "auto");

  const evidence = {
    reservationId: reservation.id,
    welcome: { welcome1, welcome2, welcome3 },
    inviteLog,
    autoInviteSuccessCount: autoInvites.filter((e) => e.status === "success")
      .length,
    adminLog,
    autoAdminSuccessCount: autoAdmins.filter((e) => e.status === "success")
      .length,
    ttlock: {
      gen2,
      gen3,
      cred,
      emailAgain1,
      emailAgain2,
    },
    adminAgain,
    verdict: {
      welcomeAutoOnce:
        autoInvites.filter((e) => e.status === "success").length === 1 &&
        welcome2.skipped === true &&
        welcome3.skipped === true,
      adminAutoOnce:
        autoAdmins.filter((e) => e.status === "success").length <= 1 &&
        adminAgain.skipped === true,
      codeEmailNotResentOnRegen:
        emailAgain1?.skipped === true && emailAgain2?.skipped === true,
      note: "Existing-credential path no longer schedules access-code email",
    },
  };

  if (cleanup) {
    await db.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  const outDir = join(process.cwd(), "docs", "audits", "evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "guest-email-duplication-audit.json"),
    JSON.stringify(evidence, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(evidence, null, 2));
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
