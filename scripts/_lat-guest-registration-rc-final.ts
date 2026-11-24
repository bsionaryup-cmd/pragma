/**
 * RC Final LAT suite — real DB, no mocks.
 * Cases: Direct multi-guest + nationalities + minor, duplicate doc, invalid Airbnb,
 * rate-limit probe, contract reconstruction, Airbnb resolve.
 *
 *   npx tsx --require ./scripts/_mock-server-only.cjs scripts/_lat-guest-registration-rc-final.ts
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BookingPlatform,
  GuestRegistrationStatus,
  ReservationStatus,
} from "@prisma/client";

config();
config({ path: ".env.local", override: true });

function extractToken(url: string): string {
  return url.split("/").pop()!;
}

async function main() {
  const { db } = await import("../src/lib/db");
  const {
    ensureGuestRegistrationForReservation,
    registerGuestStep,
    completeGuestRegistration,
    GuestRegistrationError,
  } = await import("../src/services/guests/guest-registration.service");
  const { resolveAirbnbUniversalGuestRegistration } = await import(
    "../src/services/guests/airbnb-universal-guest-registration.service"
  );
  const {
    checkAirbnbUniversalAccessRateLimit,
    buildAirbnbUniversalAccessRateLimitKey,
  } = await import(
    "../src/services/guests/airbnb-universal-guest-registration.service"
  );
  const { reconstructLodgingContractFromReservation } = await import(
    "../src/lib/guest-registration/reconstruct-lodging-contract"
  );
  const { isCanonicalGuestCompleteForGovernment, mapReservationGuestToCanonical } =
    await import("../src/lib/guest-registration/canonical-guest");

  const cases: Record<string, unknown> = { at: new Date().toISOString() };

  const property = await db.property.findFirst({
    where: {
      status: "ACTIVE",
      organizationId: { not: null },
      OR: [
        { unitNumber: "801" },
        { unitNumber: "802" },
        { name: { contains: "Margarita", mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, unitNumber: true, organizationId: true },
  });
  if (!property) throw new Error("No property for RC LAT");

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 100);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 3);

  const created = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "RC Final LAT",
      guestFirstName: "RC",
      guestLastName: "Final",
      guestEmail: "rc.final.lat@example.com",
      adults: 2,
      children: 1,
      infants: 0,
      checkIn,
      checkOut,
      platform: BookingPlatform.DIRECT,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: "PAID",
      totalAmount: 0,
      currency: "COP",
      internalNotes: "[lat] guest-registration-rc-final",
    },
    select: { id: true },
  });

  try {
    const url = await ensureGuestRegistrationForReservation(created.id);
    if (!url) throw new Error("No GR URL");
    const token = extractToken(url);
    const stamp = Date.now().toString().slice(-6);

    const basePlace = {
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

    // Owner CO
    await registerGuestStep({
      token,
      firstName: "RC",
      lastName: `Adulto-${stamp}`,
      documentType: "CC",
      documentNumber: `55${stamp}01`,
      email: `rc.adulto.${stamp}@example.com`,
      phone: "+57 3001112233",
      nationality: "CO",
      dateOfBirth: "1985-02-10",
      sex: "M",
      travelMotive: "LEISURE",
      occupation: "Médico",
      ...basePlace,
    });

    // Foreign adult
    await registerGuestStep({
      token,
      firstName: "RC",
      lastName: `Extranjero-${stamp}`,
      documentType: "PASSPORT",
      documentNumber: `P${stamp}02`,
      nationality: "US",
      dateOfBirth: "1990-07-01",
      sex: "F",
      travelMotive: "BUSINESS",
      occupation: "Engineer",
      residenceCountry: "US",
      residenceAdminArea: "California",
      residenceCity: "San Francisco",
      originCountry: "US",
      originAdminArea: "California",
      originCity: "San Francisco",
      destinationCountry: "CO",
      destinationAdminArea: "Antioquia",
      destinationCity: "Medellín",
    });

    // Duplicate document (before capacity is full)
    let duplicateBlocked = false;
    try {
      await registerGuestStep({
        token,
        firstName: "Dup",
        lastName: "Blocked",
        documentType: "CC",
        documentNumber: `55${stamp}01`,
        nationality: "CO",
        dateOfBirth: "1980-01-01",
        sex: "M",
        travelMotive: "OTHER",
        occupation: "N/A",
        ...basePlace,
      });
    } catch (error) {
      duplicateBlocked =
        error instanceof GuestRegistrationError &&
        /documento ya fue registrado/i.test(error.message);
      cases.duplicateRegistrationDetail =
        error instanceof Error ? error.message : String(error);
    }
    cases.duplicateRegistration = { ok: duplicateBlocked };

    // Minor (TI)
    await registerGuestStep({
      token,
      firstName: "RC",
      lastName: `Menor-${stamp}`,
      documentType: "TI",
      documentNumber: `55${stamp}03`,
      nationality: "CO",
      dateOfBirth: "2014-05-20",
      sex: "X",
      travelMotive: "FAMILY",
      occupation: "Estudiante",
      ...basePlace,
    });

    cases.multiGuestNationalitiesMinor = {
      ok: true,
      registered: 3,
    };

    await completeGuestRegistration(
      {
        token,
        confirmAllGuests: true,
        acceptLodgingContract: true,
        acceptHabeasData: true,
        locale: "es-CO",
      },
      { ipAddress: "198.51.100.20", userAgent: "RC-Final-LAT/1.0" },
    );

    const guests = await db.reservationGuest.findMany({
      where: { reservationId: created.id },
    });
    const tokenRow = await db.guestRegistrationToken.findFirst({
      where: { reservationId: created.id },
      orderBy: { createdAt: "desc" },
    });
    const reconstructed = await reconstructLodgingContractFromReservation(
      created.id,
    );

    cases.completion = {
      ok:
        tokenRow?.status === GuestRegistrationStatus.COMPLETED &&
        guests.length === 3 &&
        guests.every((g) =>
          isCanonicalGuestCompleteForGovernment(mapReservationGuestToCanonical(g)),
        ),
      guestCount: guests.length,
    };

    cases.contractReconstruction = {
      ok:
        Boolean(reconstructed?.reconstructableWithoutReaskingGuest) &&
        Boolean(reconstructed?.acceptance?.lodgingContractText) &&
        Boolean(reconstructed?.acceptance?.habeasDataText) &&
        reconstructed?.guests.length === 3,
      lodgingContractVersion: reconstructed?.acceptance?.lodgingContractVersion,
      hasTextSnapshot: Boolean(reconstructed?.acceptance?.lodgingContractText),
    };

    // Repeat registration on completed
    let repeatBlocked = false;
    try {
      await registerGuestStep({
        token,
        firstName: "After",
        lastName: "Complete",
        documentType: "CC",
        documentNumber: `55${stamp}99`,
        nationality: "CO",
        dateOfBirth: "1999-01-01",
        sex: "M",
        travelMotive: "OTHER",
        occupation: "N/A",
        ...basePlace,
      });
    } catch (error) {
      repeatBlocked =
        error instanceof GuestRegistrationError &&
        /ya no está activo|ya fue completado/i.test(error.message);
    }
    cases.repeatAfterComplete = { ok: repeatBlocked };

    // Invalid Airbnb code
    const invalid = await resolveAirbnbUniversalGuestRegistration({
      reservationCode: "HMZZZZZZZZ",
    });
    cases.invalidAirbnbCode = {
      ok: invalid.ok === false && invalid.reason === "invalid",
    };

    // Valid Airbnb resolve (read-only)
    const airbnb = await db.reservation.findFirst({
      where: {
        platform: BookingPlatform.AIRBNB,
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKOUT_TODAY"] },
        reservationCode: { not: null },
      },
      select: { reservationCode: true, guestRegistrationCompletedAt: true },
    });
    if (airbnb?.reservationCode?.trim()) {
      const resolved = await resolveAirbnbUniversalGuestRegistration({
        reservationCode: airbnb.reservationCode,
      });
      cases.airbnbResolve = {
        ok: resolved.ok === true,
        code: airbnb.reservationCode,
        state: "state" in resolved ? resolved.state : null,
        alreadyCompleted: Boolean(airbnb.guestRegistrationCompletedAt),
      };
    } else {
      cases.airbnbResolve = { ok: false, reason: "no_code" };
    }

    // Rate limiting (process-local)
    const ipKey = buildAirbnbUniversalAccessRateLimitKey("ip:rc-final-lat-test");
    let limited = false;
    for (let i = 0; i < 6; i++) {
      const allowed = checkAirbnbUniversalAccessRateLimit(ipKey);
      if (!allowed) {
        limited = true;
        break;
      }
    }
    cases.rateLimiting = { ok: limited };

    const required = [
      "multiGuestNationalitiesMinor",
      "duplicateRegistration",
      "completion",
      "contractReconstruction",
      "repeatAfterComplete",
      "invalidAirbnbCode",
      "airbnbResolve",
      "rateLimiting",
    ] as const;

    const allPass = required.every((key) => {
      const value = cases[key] as { ok?: boolean } | undefined;
      return value?.ok === true;
    });

    cases.result = allPass ? "PASS" : "FAIL";

    // Let fire-and-forget TTLock/admin email settle before cleanup.
    await new Promise((r) => setTimeout(r, 2000));
  } finally {
    await db.guestRegistrationLegalAcceptance.deleteMany({
      where: { reservationId: created.id },
    });
    await db.reservationGuest.deleteMany({ where: { reservationId: created.id } });
    await db.guestRegistrationToken.deleteMany({
      where: { reservationId: created.id },
    });
    await db.accessCredential.deleteMany({ where: { reservationId: created.id } });
    await db.reservation.delete({ where: { id: created.id } }).catch(() => null);
    cases.cleanedUp = true;
    cases.reservationId = created.id;
  }

  mkdirSync("docs/audits/evidence", { recursive: true });
  const out = join("docs/audits/evidence", "guest-registration-rc-final-lat.json");
  writeFileSync(out, JSON.stringify(cases, null, 2));
  console.log(JSON.stringify(cases, null, 2));
  if (cases.result !== "PASS") process.exitCode = 1;
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
