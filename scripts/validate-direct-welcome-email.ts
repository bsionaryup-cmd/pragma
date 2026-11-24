/**
 * Validación real: bienvenida Guest Registration para Reserva Directa.
 *
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/validate-direct-welcome-email.ts
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/validate-direct-welcome-email.ts --to=you@example.com
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/validate-direct-welcome-email.ts --cleanup
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

import {
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

async function main() {
  const cleanup = process.argv.includes("--cleanup");
  const to =
    argValue("--to")?.trim().toLowerCase() ||
    process.env.WELCOME_EMAIL_TEST_TO?.trim().toLowerCase() ||
    "magvillafuerte@gmail.com";

  const { db } = await import("../src/lib/db");
  const {
    parseGuestRegistrationInviteLog,
  } = await import(
    "../src/lib/guest-registration/guest-registration-invite-email-log"
  );
  const {
    resolveEmailFromAddress,
    shouldSimulateEmailDelivery,
  } = await import("../src/lib/email/send-email");
  const { ensureGuestRegistrationForReservation } = await import(
    "../src/services/guests/guest-registration.service"
  );
  const { sendGuestRegistrationEmailForReservation } = await import(
    "../src/services/guests/guest-registration-email.service"
  );

  console.info(
    JSON.stringify(
      {
        mode: shouldSimulateEmailDelivery() ? "simulado" : "real",
        from: resolveEmailFromAddress(),
        to,
        hasResendKey: Boolean(process.env.RESEND_API_KEY?.trim()),
      },
      null,
      2,
    ),
  );

  const property = await db.property.findFirst({
    where: {
      OR: [
        { unitNumber: "801" },
        { name: { contains: "Margarita", mode: "insensitive" } },
        { name: { contains: "801", mode: "insensitive" } },
      ],
      status: "ACTIVE",
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, unitNumber: true },
  });

  if (!property) {
    throw new Error("No se encontró propiedad de prueba (801 / Margarita)");
  }

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 45);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);

  const created = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "Welcome Email Validation",
      guestFirstName: "Welcome",
      guestLastName: "Validation",
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
      internalNotes: "[auto] validate-direct-welcome-email",
    },
    select: { id: true },
  });

  console.info("[create]", created.id, property.unitNumber ?? property.name);

  try {
    const url = await ensureGuestRegistrationForReservation(created.id);
    if (!url) throw new Error("No se pudo asegurar Guest Registration link");

    const first = await sendGuestRegistrationEmailForReservation(created.id, {
      triggeredBy: "auto",
    });
    console.info("[send#1]", first);

    const second = await sendGuestRegistrationEmailForReservation(created.id, {
      triggeredBy: "auto",
    });
    console.info("[send#2 dedupe]", second);

    const row = await db.reservation.findUnique({
      where: { id: created.id },
      select: {
        guestRegistrationInviteSentAt: true,
        guestRegistrationInviteError: true,
        guestRegistrationInviteLog: true,
        guestEmail: true,
      },
    });

    const log = parseGuestRegistrationInviteLog(row?.guestRegistrationInviteLog);
    console.info(
      JSON.stringify(
        {
          reservationId: created.id,
          registrationUrl: url,
          sentAt: row?.guestRegistrationInviteSentAt?.toISOString() ?? null,
          error: row?.guestRegistrationInviteError,
          log,
          checks: {
            firstOk: first.ok === true && !first.skipped,
            hasProviderId: Boolean(first.providerId),
            secondSkipped: second.skipped === true,
            logSuccess: log.some((e) => e.status === "success"),
          },
        },
        null,
        2,
      ),
    );

    if (!first.ok || first.skipped) {
      throw new Error(`Primer envío falló o se saltó: ${first.message}`);
    }
    if (!second.skipped) {
      throw new Error("Anti-duplicados falló: segundo envío no fue skipped");
    }
    if (!log.some((e) => e.status === "success" && e.providerId)) {
      throw new Error("Historial sin success+providerId");
    }
  } finally {
    if (cleanup) {
      await db.reservation.update({
        where: { id: created.id },
        data: { status: ReservationStatus.CANCELLED },
      });
      console.info("[cleanup] reservation cancelled", created.id);
    } else {
      console.info(
        "[note] Reserva de prueba dejada CONFIRMED. Usa --cleanup para cancelarla.",
      );
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
