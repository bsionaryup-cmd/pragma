/**
 * Reproducción controlada de la incidencia (solo auditoría, sin fix).
 * Compara Direct totalAmount=0 vs Direct totalAmount>0 (hold).
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config();
config({ path: ".env.local", override: true });

async function main() {
  const {
    BookingPlatform,
    ReservationStatus,
  } = await import("@prisma/client");
  const { db } = await import("../src/lib/db");
  const { parseGuestRegistrationInviteLog } = await import(
    "../src/lib/guest-registration/guest-registration-invite-email-log"
  );
  const { sendGuestRegistrationEmailForReservation } = await import(
    "../src/services/guests/guest-registration-email.service"
  );
  const { ensureGuestRegistrationForReservation } = await import(
    "../src/services/guests/guest-registration.service"
  );

  // Real incident candidate
  const incident = await db.reservation.findUnique({
    where: { id: "cmrnm2qbv000e04l7f17j5nih" },
    select: {
      id: true,
      platform: true,
      status: true,
      guestEmail: true,
      totalAmount: true,
      holdExpiresAt: true,
      paymentStatus: true,
      guestRegistrationInviteSentAt: true,
      guestRegistrationInviteError: true,
      guestRegistrationInviteLog: true,
      guestRegistrationToken: true,
      createdAt: true,
      property: { select: { unitNumber: true, name: true } },
    },
  });

  // Simulate what createReservation does for hold path: activate hold then try send
  const property = await db.property.findFirst({
    where: { unitNumber: "801", status: "ACTIVE" },
    select: { id: true },
  });
  if (!property) throw new Error("801 missing");

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 80);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 1);

  const withHold = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "Incident Repro Hold",
      guestFirstName: "Repro",
      guestEmail: "magvillafuerte@gmail.com",
      adults: 1,
      children: 0,
      infants: 0,
      checkIn,
      checkOut,
      platform: BookingPlatform.DIRECT,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: "PENDING",
      totalAmount: 150000,
      holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      currency: "COP",
      internalNotes: "[audit] welcome-incident-repro-hold",
    },
    select: { id: true, holdExpiresAt: true, totalAmount: true },
  });

  // Mirror createReservation: with hold, it does NOT call ensure/send
  // Then if someone later calls send auto (as if wrongly), service skips on hold
  const sendWhileHold = await sendGuestRegistrationEmailForReservation(
    withHold.id,
    { triggeredBy: "auto" },
  );

  // Zero amount path: ensure + send (what audits did)
  const zero = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "Incident Repro Zero",
      guestFirstName: "ReproZero",
      guestEmail: "magvillafuerte@gmail.com",
      adults: 1,
      children: 0,
      infants: 0,
      checkIn: new Date(checkIn.getTime() + 3 * 86400000),
      checkOut: new Date(checkOut.getTime() + 3 * 86400000),
      platform: BookingPlatform.DIRECT,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: "PAID",
      totalAmount: 0,
      currency: "COP",
      internalNotes: "[audit] welcome-incident-repro-zero",
    },
    select: { id: true },
  });
  await ensureGuestRegistrationForReservation(zero.id);
  const sendZero = await sendGuestRegistrationEmailForReservation(zero.id, {
    triggeredBy: "auto",
  });
  const zeroRow = await db.reservation.findUnique({
    where: { id: zero.id },
    select: {
      guestRegistrationInviteSentAt: true,
      guestRegistrationInviteLog: true,
    },
  });

  await db.reservation.updateMany({
    where: { id: { in: [withHold.id, zero.id] } },
    data: { status: ReservationStatus.CANCELLED },
  });

  const evidence = {
    incidentReservation: {
      ...incident,
      total: incident ? Number(incident.totalAmount) : null,
      inviteLog: parseGuestRegistrationInviteLog(
        incident?.guestRegistrationInviteLog,
      ),
    },
    rootCauseHypothesis: {
      statement:
        "createReservation only sends welcome when totalAmount === 0. If totalAmount > 0 it activates payment hold and defers welcome until releaseReservationHoldIfDepositMet.",
      codePath:
        "reservation.service.ts L619-640; guest-registration-email.service.ts L281-287 (skip if holdExpiresAt)",
      whyAuditsPassed: "All prior E2E/smoke used totalAmount: 0",
      whyRealUIFails:
        "Wizard requires totalAmount; real Direct bookings almost always > 0 → hold path → no welcome until deposit",
    },
    reproduction: {
      withHold: {
        id: withHold.id,
        holdExpiresAt: withHold.holdExpiresAt,
        sendWhileHold,
        expected: "skipped: Reserva en hold de pago",
      },
      zeroAmount: {
        id: zero.id,
        sendZero,
        inviteSentAt: zeroRow?.guestRegistrationInviteSentAt,
        log: parseGuestRegistrationInviteLog(
          zeroRow?.guestRegistrationInviteLog,
        ),
        expected: "welcome sent",
      },
    },
  };

  const outDir = join(process.cwd(), "docs", "audits", "evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "welcome-email-incident-root-cause.json"),
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
