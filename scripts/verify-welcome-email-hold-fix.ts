/**
 * Regresión post-fix: bienvenida Direct con totalAmount > 0 (hold).
 * Valida también Airbnb skip + anti-dupe.
 *
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/verify-welcome-email-hold-fix.ts --cleanup
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config();
config({ path: ".env.local", override: true });

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const {
    BookingPlatform,
    ReservationStatus,
    PaymentStatus,
  } = await import("@prisma/client");
  const { db } = await import("../src/lib/db");
  const { parseGuestRegistrationInviteLog } = await import(
    "../src/lib/guest-registration/guest-registration-invite-email-log"
  );
  const { ensureGuestRegistrationForReservation } = await import(
    "../src/services/guests/guest-registration.service"
  );
  const { sendGuestRegistrationEmailForReservation } = await import(
    "../src/services/guests/guest-registration-email.service"
  );
  const { activateReservationPaymentHold } = await import(
    "../src/services/reservations/reservation-hold.service"
  );
  const { computeHoldExpiresAt } = await import(
    "../src/lib/reservations/reservation-hold"
  );

  const property = await db.property.findFirst({
    where: { unitNumber: "801", status: "ACTIVE" },
    select: { id: true, unitNumber: true },
  });
  if (!property) throw new Error("801 missing");

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 85);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);

  // Mirror FIXED createReservation order: ensure+send THEN hold
  const direct = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "Hold Fix Verify",
      guestFirstName: "HoldFix",
      guestEmail: "magvillafuerte@gmail.com",
      adults: 1,
      children: 0,
      infants: 0,
      checkIn,
      checkOut,
      platform: BookingPlatform.DIRECT,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PENDING,
      totalAmount: 196510,
      currency: "COP",
      internalNotes: "[verify] welcome-before-hold-fix",
    },
    select: { id: true },
  });

  await ensureGuestRegistrationForReservation(direct.id);
  const welcome = await sendGuestRegistrationEmailForReservation(direct.id, {
    triggeredBy: "auto",
  });

  // Activate hold AFTER welcome (new createReservation order)
  await db.reservation.update({
    where: { id: direct.id },
    data: {
      holdExpiresAt: computeHoldExpiresAt(),
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  const dedupe = await sendGuestRegistrationEmailForReservation(direct.id, {
    triggeredBy: "auto",
  });

  const directRow = await db.reservation.findUnique({
    where: { id: direct.id },
    select: {
      holdExpiresAt: true,
      guestRegistrationInviteSentAt: true,
      guestRegistrationInviteLog: true,
      guestRegistrationToken: true,
    },
  });

  // Airbnb still no welcome
  const airbnb = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "Airbnb Hold Verify",
      guestFirstName: "Airbnb",
      guestEmail: "magvillafuerte@gmail.com",
      adults: 1,
      children: 0,
      infants: 0,
      checkIn: new Date(checkIn.getTime() + 4 * 86400000),
      checkOut: new Date(checkOut.getTime() + 4 * 86400000),
      platform: BookingPlatform.AIRBNB,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: 100000,
      currency: "COP",
      internalNotes: "[verify] airbnb-no-welcome",
    },
    select: { id: true },
  });
  await ensureGuestRegistrationForReservation(airbnb.id);
  const airbnbSend = await sendGuestRegistrationEmailForReservation(airbnb.id, {
    triggeredBy: "auto",
  });

  // Recover incident reservation if still pending invite
  const incidentId = "cmrnm2qbv000e04l7f17j5nih";
  const incidentBefore = await db.reservation.findUnique({
    where: { id: incidentId },
    select: {
      guestRegistrationInviteSentAt: true,
      holdExpiresAt: true,
      guestEmail: true,
      status: true,
      platform: true,
    },
  });
  let incidentRecovery: Record<string, unknown> | null = null;
  if (
    incidentBefore &&
    incidentBefore.platform === BookingPlatform.DIRECT &&
    incidentBefore.status === ReservationStatus.CONFIRMED &&
    !incidentBefore.guestRegistrationInviteSentAt &&
    incidentBefore.guestEmail
  ) {
    await ensureGuestRegistrationForReservation(incidentId);
    const recovered = await sendGuestRegistrationEmailForReservation(
      incidentId,
      { force: true, triggeredBy: "manual" },
    );
    const after = await db.reservation.findUnique({
      where: { id: incidentId },
      select: {
        guestRegistrationInviteSentAt: true,
        guestRegistrationInviteLog: true,
      },
    });
    incidentRecovery = {
      recovered,
      sentAt: after?.guestRegistrationInviteSentAt,
      log: parseGuestRegistrationInviteLog(after?.guestRegistrationInviteLog),
    };
  }

  if (cleanup) {
    await db.reservation.updateMany({
      where: { id: { in: [direct.id, airbnb.id] } },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  void activateReservationPaymentHold;

  const evidence = {
    directWithAmount: {
      id: direct.id,
      welcome,
      dedupe,
      holdAfterWelcome: Boolean(directRow?.holdExpiresAt),
      inviteSentAt: directRow?.guestRegistrationInviteSentAt,
      log: parseGuestRegistrationInviteLog(
        directRow?.guestRegistrationInviteLog,
      ),
      hasToken: Boolean(directRow?.guestRegistrationToken),
      pass:
        welcome.ok === true &&
        Boolean(welcome.providerId) &&
        dedupe.skipped === true &&
        Boolean(directRow?.holdExpiresAt) &&
        Boolean(directRow?.guestRegistrationInviteSentAt),
    },
    airbnb: {
      id: airbnb.id,
      airbnbSend,
      pass: airbnbSend.skipped === true,
    },
    incidentRecovery,
    allPass: false as boolean,
  };
  evidence.allPass =
    evidence.directWithAmount.pass &&
    evidence.airbnb.pass &&
    (incidentRecovery
      ? Boolean(
          (incidentRecovery as { recovered?: { ok?: boolean } }).recovered?.ok,
        )
      : true);

  const outDir = join(process.cwd(), "docs", "audits", "evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "welcome-email-hold-fix-verify.json"),
    JSON.stringify(evidence, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.allPass) process.exitCode = 1;
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
