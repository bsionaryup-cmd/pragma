/**
 * Staging-only E2E: publish, book, calendar presence, conflict, cancel.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.staging"), override: true });

execSync("node scripts/staging/assert-staging-db.mjs", {
  stdio: "inherit",
  env: process.env,
});

async function main() {
  const { db } = await import("@/lib/db");
  const { WebSiteStatus, ReservationStatus, BookingPlatform } = await import(
    "@prisma/client"
  );
  const {
    searchWebAvailability,
    createWebDirectReservation,
  } = await import("@/services/web-builder/web-booking.service");
  const { findOverlappingReservation } = await import(
    "@/services/reservations/reservation-conflicts"
  );
  const { dateKeyToPrismaDate } = await import("@/lib/dates");

  const site = await db.tenantWebSite.findUnique({
    where: { slug: "urbanovaloft" },
    include: {
      propertyLinks: {
        where: { isPublished: true },
        take: 1,
        include: { property: { select: { id: true, unitNumber: true } } },
      },
    },
  });
  if (!site || site.propertyLinks.length === 0) {
    throw new Error("Staging site/property missing — run npm run staging:seed");
  }

  await db.tenantWebSite.update({
    where: { id: site.id },
    data: {
      status: WebSiteStatus.PUBLISHED,
      publishedAt: new Date(),
      bookingEnabled: true,
    },
  });
  await db.tenantWebPage.updateMany({
    where: { siteId: site.id, isVisible: true },
    data: { status: WebSiteStatus.PUBLISHED },
  });

  const propertyId = site.propertyLinks[0]!.property.id;
  const unit = site.propertyLinks[0]!.property.unitNumber;
  const checkIn = "2099-07-10";
  const checkOut = "2099-07-13";

  await db.reservation.deleteMany({
    where: {
      propertyId,
      checkIn: dateKeyToPrismaDate(checkIn),
      checkOut: dateKeyToPrismaDate(checkOut),
      OR: [
        { internalNotes: { contains: "[WEB_BUILDER][STAGING_E2E]" } },
        { internalNotes: { contains: "idempotency=stg-e2e" } },
      ],
    },
  });

  const availability = await searchWebAvailability({
    slug: "urbanovaloft",
    checkIn,
    checkOut,
    guests: 2,
  });
  if (!availability.available.some((row) => row.propertyId === propertyId)) {
    throw new Error("Expected property available in staging search");
  }
  const quote = availability.available.find((r) => r.propertyId === propertyId)!.quote;

  const created = await createWebDirectReservation({
    slug: "urbanovaloft",
    propertyId,
    checkIn,
    checkOut,
    adults: 2,
    children: 0,
    infants: 0,
    guestFirstName: "Staging",
    guestLastName: "Guest",
    guestEmail: "staging-guest@example.invalid",
    totalAmount: quote.total,
    policiesAccepted: true,
    idempotencyKey: "stg-e2e-primary-2099-07",
  });

  await db.reservation.update({
    where: { id: created.reservationId },
    data: {
      internalNotes:
        `[WEB_BUILDER][STAGING_E2E] origen=web_directa slug=urbanovaloft idempotency=stg-e2e-primary-2099-07`,
    },
  });

  const calendarRow = await db.reservation.findFirst({
    where: {
      id: created.reservationId,
      property: { organizationId: site.organizationId },
      status: { not: ReservationStatus.CANCELLED },
    },
    select: {
      id: true,
      platform: true,
      status: true,
      paymentStatus: true,
      checkIn: true,
      checkOut: true,
      propertyId: true,
      property: { select: { organizationId: true, unitNumber: true } },
    },
  });

  const replay = await createWebDirectReservation({
    slug: "urbanovaloft",
    propertyId,
    checkIn,
    checkOut,
    adults: 2,
    children: 0,
    infants: 0,
    guestFirstName: "Staging",
    guestLastName: "Guest",
    totalAmount: quote.total,
    policiesAccepted: true,
    idempotencyKey: "stg-e2e-primary-2099-07",
  });

  let doubleBookingBlocked = false;
  try {
    await createWebDirectReservation({
      slug: "urbanovaloft",
      propertyId,
      checkIn,
      checkOut,
      adults: 1,
      children: 0,
      infants: 0,
      guestFirstName: "Conflict",
      guestLastName: "Attempt",
      totalAmount: quote.total,
      policiesAccepted: true,
      idempotencyKey: "stg-e2e-conflict-2099-07",
    });
  } catch {
    doubleBookingBlocked = true;
  }

  // Concurrent race: both should not succeed as two active bookings
  const raceCheckIn = "2099-08-01";
  const raceCheckOut = "2099-08-03";
  await db.reservation.deleteMany({
    where: {
      propertyId,
      checkIn: dateKeyToPrismaDate(raceCheckIn),
      checkOut: dateKeyToPrismaDate(raceCheckOut),
    },
  });
  const raceResults = await Promise.allSettled([
    createWebDirectReservation({
      slug: "urbanovaloft",
      propertyId,
      checkIn: raceCheckIn,
      checkOut: raceCheckOut,
      adults: 1,
      children: 0,
      infants: 0,
      guestFirstName: "Race",
      guestLastName: "A",
      totalAmount: quote.total,
      policiesAccepted: true,
      idempotencyKey: "stg-race-a",
    }),
    createWebDirectReservation({
      slug: "urbanovaloft",
      propertyId,
      checkIn: raceCheckIn,
      checkOut: raceCheckOut,
      adults: 1,
      children: 0,
      infants: 0,
      guestFirstName: "Race",
      guestLastName: "B",
      totalAmount: quote.total,
      policiesAccepted: true,
      idempotencyKey: "stg-race-b",
    }),
  ]);
  const raceWins = raceResults.filter((r) => r.status === "fulfilled").length;
  const raceActive = await db.reservation.count({
    where: {
      propertyId,
      checkIn: dateKeyToPrismaDate(raceCheckIn),
      checkOut: dateKeyToPrismaDate(raceCheckOut),
      status: { not: ReservationStatus.CANCELLED },
    },
  });

  const overlap = await findOverlappingReservation(
    propertyId,
    dateKeyToPrismaDate(checkIn),
    dateKeyToPrismaDate(checkOut),
  );

  await db.reservation.update({
    where: { id: created.reservationId },
    data: { status: ReservationStatus.CANCELLED },
  });
  await db.reservation.updateMany({
    where: {
      propertyId,
      checkIn: dateKeyToPrismaDate(raceCheckIn),
      status: { not: ReservationStatus.CANCELLED },
    },
    data: { status: ReservationStatus.CANCELLED },
  });

  const afterCancel = await searchWebAvailability({
    slug: "urbanovaloft",
    checkIn,
    checkOut,
    guests: 2,
  });

  // Keep PUBLISHED for browser validation of this phase
  console.log(
    JSON.stringify(
      {
        ok: true,
        unit,
        reservationId: calendarRow?.id,
        platform: calendarRow?.platform,
        organizationId: calendarRow?.property.organizationId,
        appearsInCalendarQuery: Boolean(calendarRow),
        paymentStatus: calendarRow?.paymentStatus,
        idempotentReplay: replay.idempotentReplay === true,
        idempotentSameId: replay.reservationId === created.reservationId,
        doubleBookingBlocked,
        overlapMatchedCreated: overlap?.id === created.reservationId,
        raceWins,
        raceActiveBeforeCleanup: raceActive,
        raceSafe: raceActive <= 1,
        availableAgainAfterCancel: afterCancel.available.some(
          (r) => r.propertyId === propertyId,
        ),
        expectedPlatform: BookingPlatform.DIRECT,
        siteStatus: "PUBLISHED",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
