/**
 * LAT real (no mocks): Direct reservation → canonical GR → legal acceptance → SIRE/TRA map.
 * Creates a temporary DIRECT reservation and cleans it up by default.
 *
 *   npx tsx --require ./scripts/_mock-server-only.cjs scripts/_lat-guest-registration-canonical-legal.ts
 *   npx tsx --require ./scripts/_mock-server-only.cjs scripts/_lat-guest-registration-canonical-legal.ts --keep
 */
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
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
  const keep = process.argv.includes("--keep");
  const { db } = await import("../src/lib/db");
  const {
    ensureGuestRegistrationForReservation,
    registerGuestStep,
    completeGuestRegistration,
  } = await import("../src/services/guests/guest-registration.service");
  const {
    isCanonicalGuestCompleteForGovernment,
    mapCanonicalGuestToSirePayload,
    mapCanonicalGuestToTraPayload,
    mapReservationGuestToCanonical,
  } = await import("../src/lib/guest-registration/canonical-guest");
  const {
    GUEST_HABEAS_DATA_POLICY_VERSION,
    GUEST_LODGING_CONTRACT_VERSION,
  } = await import("../src/lib/guest-registration/guest-legal-versions");
  const { resolveAirbnbUniversalGuestRegistration } = await import(
    "../src/services/guests/airbnb-universal-guest-registration.service"
  );

  const evidence: Record<string, unknown> = {
    at: new Date().toISOString(),
    lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
    habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
  };

  const property = await db.property.findFirst({
    where: {
      status: "ACTIVE",
      organizationId: { not: null },
      OR: [
        { unitNumber: "801" },
        { name: { contains: "Margarita", mode: "insensitive" } },
        { unitNumber: "802" },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      unitNumber: true,
      organizationId: true,
      maxGuests: true,
    },
  });
  if (!property) throw new Error("No active property found for LAT");

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 90);
  checkIn.setUTCHours(0, 0, 0, 0);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);

  const created = await db.reservation.create({
    data: {
      propertyId: property.id,
      guestName: "LAT Canonical Legal",
      guestFirstName: "LAT",
      guestLastName: "Canonical",
      guestEmail: "lat.canonical.legal@example.com",
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
      internalNotes: "[lat] guest-registration-canonical-legal",
    },
    select: { id: true },
  });

  evidence.reservationId = created.id;
  evidence.property = {
    id: property.id,
    name: property.name,
    unitNumber: property.unitNumber,
    organizationId: property.organizationId,
  };

  try {
    const url = await ensureGuestRegistrationForReservation(created.id);
    if (!url) throw new Error("No GR URL");
    const token = extractToken(url);
    evidence.registrationUrl = url;

    const stamp = Date.now().toString().slice(-6);
    const profile = {
      nationality: "CO",
      dateOfBirth: "1988-06-15",
      sex: "F" as const,
      travelMotive: "LEISURE" as const,
      occupation: "Arquitecta",
      residenceCountry: "CO",
      residenceAdminArea: "Antioquia",
      residenceCity: "Medellín",
      originCountry: "CO",
      originAdminArea: "Cundinamarca",
      originCity: "Bogotá, D.C.",
      destinationCountry: "CO",
      destinationAdminArea: "Antioquia",
      destinationCity: "Medellín",
    };

    await registerGuestStep({
      token,
      firstName: "LAT",
      lastName: `Titular-${stamp}`,
      documentType: "CC",
      documentNumber: `77${stamp}01`,
      email: `lat.titular.${stamp}@example.com`,
      phone: "+57 3105556677",
      ...profile,
    });

    await registerGuestStep({
      token,
      firstName: "LAT",
      lastName: `Acompanante-${stamp}`,
      documentType: "CE",
      documentNumber: `77${stamp}02`,
      ...profile,
      nationality: "VE",
      sex: "M",
      travelMotive: "FAMILY",
      occupation: "Estudiante",
      dateOfBirth: "2001-01-20",
      residenceCountry: "VE",
      residenceAdminArea: "Distrito Capital",
      residenceCity: "Caracas",
      originCountry: "VE",
      originAdminArea: "Distrito Capital",
      originCity: "Caracas",
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
        ipAddress: "203.0.113.10",
        userAgent: "LAT-canonical-legal/1.0",
      },
    );

    const guests = await db.reservationGuest.findMany({
      where: { reservationId: created.id },
      orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
    });
    const acceptance = await db.guestRegistrationLegalAcceptance.findUnique({
      where: { reservationId: created.id },
    });
    const tokenRow = await db.guestRegistrationToken.findFirst({
      where: { reservationId: created.id },
      orderBy: { createdAt: "desc" },
    });
    const reservation = await db.reservation.findUniqueOrThrow({
      where: { id: created.id },
      select: {
        guestRegistrationCompletedAt: true,
        guestEmail: true,
        guestPhone: true,
        guestName: true,
        guestCountry: true,
        checkIn: true,
        checkOut: true,
        totalAmount: true,
        currency: true,
        platform: true,
        reservationCode: true,
        propertyId: true,
        property: { select: { organizationId: true, unitNumber: true, propertyType: true } },
      },
    });

    const canonical = guests.map((g) => mapReservationGuestToCanonical(g));
    const stay = {
      reservationId: created.id,
      organizationId: reservation.property.organizationId,
      propertyId: reservation.propertyId,
      checkIn: reservation.checkIn.toISOString().slice(0, 10),
      checkOut: reservation.checkOut.toISOString().slice(0, 10),
      platform: String(reservation.platform),
      reservationCode: reservation.reservationCode,
      companionCount: Math.max(0, guests.length - 1),
      roomLabel: reservation.property.unitNumber,
      totalAmount: reservation.totalAmount?.toString() ?? null,
      currency: reservation.currency,
      paymentMedium: null,
      bookingMedium: String(reservation.platform),
      propertyType: reservation.property.propertyType,
    };

    evidence.guests = canonical.map((g) => ({
      fullName: g.fullName,
      documentType: g.documentType,
      phoneE164: g.phoneE164,
      nationalityIso: g.nationalityIso,
      sex: g.sex,
      travelMotive: g.travelMotive,
      complete: isCanonicalGuestCompleteForGovernment(g),
    }));
    evidence.legalAcceptance = acceptance
      ? {
          lodgingContractVersion: acceptance.lodgingContractVersion,
          habeasDataPolicyVersion: acceptance.habeasDataPolicyVersion,
          acceptedAt: acceptance.acceptedAt.toISOString(),
          ipAddress: acceptance.ipAddress,
          userAgent: acceptance.userAgent,
          locale: acceptance.locale,
          organizationId: acceptance.organizationId,
          titularFullName: acceptance.titularFullName,
        }
      : null;
    evidence.tokenStatus = tokenRow?.status ?? null;
    evidence.reservationSnapshot = {
      completedAt: reservation.guestRegistrationCompletedAt?.toISOString() ?? null,
      guestName: reservation.guestName,
      guestEmail: reservation.guestEmail,
      guestPhone: reservation.guestPhone,
      guestCountry: reservation.guestCountry,
    };
    evidence.sireSample = canonical[0]
      ? mapCanonicalGuestToSirePayload(canonical[0], stay)
      : null;
    evidence.traSample = canonical[0]
      ? mapCanonicalGuestToTraPayload(canonical[0], stay)
      : null;

    // Airbnb universal access still resolves independently (smoke read-only probe)
    const airbnbProbe = await db.reservation.findFirst({
      where: {
        platform: BookingPlatform.AIRBNB,
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKOUT_TODAY"] },
        reservationCode: { not: null },
      },
      select: { reservationCode: true },
    });
    const airbnbCode = airbnbProbe?.reservationCode?.trim();
    if (airbnbCode) {
      try {
        const resolved = await resolveAirbnbUniversalGuestRegistration({
          reservationCode: airbnbCode,
        });
        evidence.airbnbUniversalProbe = {
          code: airbnbCode,
          ok: resolved.ok,
          state: "state" in resolved ? resolved.state : null,
          reason: "reason" in resolved ? resolved.reason : null,
        };
      } catch (error) {
        evidence.airbnbUniversalProbe = {
          code: airbnbCode,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } else {
      evidence.airbnbUniversalProbe = { skipped: true, reason: "no_airbnb_code" };
    }

    const pass =
      tokenRow?.status === GuestRegistrationStatus.COMPLETED &&
      Boolean(acceptance) &&
      acceptance?.ipAddress === "203.0.113.10" &&
      acceptance?.userAgent === "LAT-canonical-legal/1.0" &&
      guests.length === 2 &&
      canonical.every(isCanonicalGuestCompleteForGovernment) &&
      Boolean(reservation.guestRegistrationCompletedAt) &&
      Boolean(reservation.guestPhone?.startsWith("+57"));

    evidence.result = pass ? "PASS" : "FAIL";

    // Allow fire-and-forget admin notify to settle before cleanup.
    await new Promise((r) => setTimeout(r, 1500));
  } finally {
    if (!keep) {
      await db.guestRegistrationLegalAcceptance.deleteMany({
        where: { reservationId: created.id },
      });
      await db.reservationGuest.deleteMany({ where: { reservationId: created.id } });
      await db.guestRegistrationToken.deleteMany({
        where: { reservationId: created.id },
      });
      await db.accessCredential.deleteMany({ where: { reservationId: created.id } });
      await db.reservation.delete({ where: { id: created.id } }).catch(() => null);
      evidence.cleanedUp = true;
    } else {
      evidence.cleanedUp = false;
    }
  }

  mkdirSync("docs/audits/evidence", { recursive: true });
  const out = join(
    "docs/audits/evidence",
    "guest-registration-canonical-legal-lat.json",
  );
  writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  if (evidence.result !== "PASS") process.exitCode = 1;
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
