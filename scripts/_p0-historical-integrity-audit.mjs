/**
 * P0 Historical Reservation Integrity Audit
 * node scripts/_p0-historical-integrity-audit.mjs
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PaymentStatus,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const CUTOFF = "2026-05-25";
const HISTORICAL_PREFIX = "pragma-historical:";
const EXPECTED_HISTORICAL_REVENUE = 5477179.03;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const approvedHistorical = JSON.parse(
  readFileSync(new URL("../data/don-samuel-historical-approved.json", import.meta.url), "utf8"),
);

const ACCOUNTING_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
];

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function activeIcalFilter() {
  return {
    OR: [
      { icalUrl: { startsWith: "https://" } },
      { icalUrl: { startsWith: "http://" } },
      { icalUrl: { startsWith: "webcal://" } },
    ],
  };
}

function withVisible(where) {
  return {
    AND: [
      where,
      {
        OR: [
          { property: activeIcalFilter() },
          { AND: [{ icalUid: null }, { platform: { not: "AIRBNB" } }] },
        ],
      },
    ],
  };
}

async function main() {
  const allReservations = await db.reservation.findMany({
    where: { property: { organizationId: ORG } },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      platform: true,
      icalUid: true,
      reservationCode: true,
      totalAmount: true,
      paymentStatus: true,
      createdAt: true,
      updatedAt: true,
      property: { select: { id: true, name: true, unitNumber: true } },
      emailEvents: {
        select: {
          id: true,
          eventKind: true,
          confirmationCode: true,
          enrichedFields: true,
        },
      },
    },
    orderBy: { checkIn: "asc" },
  });

  const historicalInDb = allReservations.filter((r) =>
    r.icalUid?.startsWith(HISTORICAL_PREFIX),
  );

  const approvedCodes = approvedHistorical.reservations.map((r) =>
    r.code.toUpperCase(),
  );
  const dbHistoricalCodes = historicalInDb
    .map((r) => r.reservationCode ?? r.icalUid?.slice(HISTORICAL_PREFIX.length))
    .filter(Boolean)
    .map((c) => c.toUpperCase());

  const missingFromDb = approvedHistorical.reservations.filter(
    (r) => !dbHistoricalCodes.includes(r.code.toUpperCase()),
  );
  const extraInDb = historicalInDb.filter((r) => {
    const code =
      r.reservationCode ?? r.icalUid?.slice(HISTORICAL_PREFIX.length) ?? "";
    return code && !approvedCodes.includes(code.toUpperCase());
  });

  const checkedOut = allReservations.filter(
    (r) => r.status === ReservationStatus.CHECKED_OUT,
  );
  const cancelled = allReservations.filter(
    (r) => r.status === ReservationStatus.CANCELLED,
  );

  const visibleHistorical = await db.reservation.count({
    where: withVisible({
      property: { organizationId: ORG },
      icalUid: { startsWith: HISTORICAL_PREFIX },
    }),
  });

  const historicalRevenue = historicalInDb
    .filter(
      (r) =>
        ACCOUNTING_STATUSES.includes(r.status) &&
        r.paymentStatus === PaymentStatus.PAID,
    )
    .reduce((sum, r) => sum + Number(r.totalAmount), 0);

  const allAccountingRevenue = allReservations
    .filter(
      (r) =>
        ACCOUNTING_STATUSES.includes(r.status) &&
        r.paymentStatus === PaymentStatus.PAID,
    )
    .reduce((sum, r) => sum + Number(r.totalAmount), 0);

  // Email events pointing to reservations in org
  const emailEvents = await db.reservationEmailEvent.findMany({
    where: { reservation: { property: { organizationId: ORG } } },
    select: {
      id: true,
      reservationId: true,
      confirmationCode: true,
      eventKind: true,
      enrichedFields: true,
      reservation: {
        select: { guestName: true, checkIn: true, checkOut: true, status: true },
      },
    },
  });

  // Audits with reservationId set
  const linkedAudits = await db.emailIngestionAudit.findMany({
    where: { organizationId: ORG, reservationId: { not: null } },
    select: {
      id: true,
      reservationId: true,
      subject: true,
      processingStatus: true,
      createdAt: true,
    },
  });

  const auditReservationIds = new Set(
    linkedAudits.map((a) => a.reservationId).filter(Boolean),
  );
  const dbReservationIds = new Set(allReservations.map((r) => r.id));
  const orphanAuditLinks = [...auditReservationIds].filter(
    (id) => !dbReservationIds.has(id),
  );

  // Activities
  const activities = await db.reservationActivity.findMany({
    where: { reservation: { property: { organizationId: ORG } } },
    select: {
      id: true,
      reservationId: true,
      activityType: true,
      createdAt: true,
    },
    take: 5000,
  });
  const activityReservationIds = new Set(activities.map((a) => a.reservationId));
  const orphanActivities = [...activityReservationIds].filter(
    (id) => !dbReservationIds.has(id),
  );

  // Email events for confirmation codes not in DB
  const emailCodesInDb = new Set(
    allReservations
      .map((r) => r.reservationCode?.toUpperCase())
      .filter(Boolean),
  );
  const emailCodesFromEvents = new Set(
    emailEvents
      .map((e) => e.confirmationCode?.toUpperCase())
      .filter(Boolean),
  );
  const emailCodesNotInDb = [...emailCodesFromEvents].filter(
    (c) => !emailCodesInDb.has(c) && !dbHistoricalCodes.includes(c),
  );

  // Finance manual records (scoped via org properties' owner)
  const orgProperties = await db.property.findMany({
    where: { organizationId: ORG },
    select: { ownerId: true },
  });
  const ownerIds = [...new Set(orgProperties.map((p) => p.ownerId))];

  const manualExpenses = await db.manualExpense.findMany({
    where: { createdById: { in: ownerIds }, deletedAt: null },
    select: { id: true, amount: true, expenseDate: true, category: true },
  });
  const otherIncomes = await db.otherIncome.findMany({
    where: { createdById: { in: ownerIds }, deletedAt: null },
    select: { id: true, amount: true, incomeDate: true, incomeType: true },
  });

  // Monthly reservation revenue (check-in month)
  const monthlyReservationRevenue = {};
  for (const r of allReservations) {
    if (!ACCOUNTING_STATUSES.includes(r.status)) continue;
    if (r.paymentStatus !== PaymentStatus.PAID) continue;
    const month = dateKey(r.checkIn).slice(0, 7);
    monthlyReservationRevenue[month] =
      (monthlyReservationRevenue[month] ?? 0) + Number(r.totalAmount);
  }

  const aprilDb = historicalInDb.filter((r) =>
    dateKey(r.checkIn).startsWith("2026-04"),
  );
  const mayDb = historicalInDb.filter((r) => {
    const k = dateKey(r.checkIn);
    return k.startsWith("2026-05") && k < CUTOFF;
  });

  const victoria = historicalInDb.find((r) =>
    r.icalUid?.includes("VICTORIA20260528"),
  );

  const report = {
    auditedAt: new Date().toISOString(),
    organizationId: ORG,
    sourceOfTruth: {
      approvedHistoricalFile: "data/don-samuel-historical-approved.json",
      approvedCount: approvedHistorical.reservations.length,
      expectedHistoricalRevenue: EXPECTED_HISTORICAL_REVENUE,
      cutoff: CUTOFF,
    },
    currentInventory: {
      totalInDb: allReservations.length,
      historicalBackfill: historicalInDb.length,
      checkedOut: checkedOut.length,
      cancelled: cancelled.length,
      visibleHistorical,
    },
    historicalReconciliation: {
      approvedPresent: approvedHistorical.reservations.length - missingFromDb.length,
      approvedMissing: missingFromDb.length,
      missingDetails: missingFromDb,
      extraHistoricalNotInApproved: extraInDb.map((r) => ({
        id: r.id,
        code: r.reservationCode ?? r.icalUid,
        guest: r.guestName,
        checkIn: dateKey(r.checkIn),
      })),
      aprilCount: aprilDb.length,
      mayBeforeCutoffCount: mayDb.length,
      victoriaPresent: Boolean(victoria),
      historicalRevenue,
      revenueMatchesApproved:
        Math.abs(historicalRevenue - EXPECTED_HISTORICAL_REVENUE) < 0.02,
    },
    disappearanceAnalysis: {
      orphanAuditReservationLinks: orphanAuditLinks.length,
      orphanAuditSamples: orphanAuditLinks.slice(0, 10),
      orphanActivityReservationLinks: orphanActivities.length,
      orphanActivitySamples: orphanActivities.slice(0, 10),
      emailConfirmationCodesWithoutReservation: emailCodesNotInDb.length,
      emailCodesNotInDbSamples: emailCodesNotInDb.slice(0, 15),
      priorDeletionCause:
        "iCal stale cancellation + purgeGhostReservations deleteMany (fixed in 01848ee)",
    },
    crossModuleImpact: {
      emailEventsLinked: emailEvents.length,
      linkedAudits: linkedAudits.length,
      activitiesLinked: activities.length,
      allAccountingRevenue,
      monthlyReservationRevenue,
      manualExpensesCount: manualExpenses.length,
      otherIncomesCount: otherIncomes.length,
    },
    integrityChecks: {
      all16ApprovedPresent: missingFromDb.length === 0,
      victoriaPresent: Boolean(victoria),
      historicalRevenueOk:
        Math.abs(historicalRevenue - EXPECTED_HISTORICAL_REVENUE) < 0.02,
      allHistoricalVisible: visibleHistorical === historicalInDb.length,
      noCancelledHistorical: historicalInDb.every(
        (r) => r.status !== ReservationStatus.CANCELLED,
      ),
      noOrphanAuditLinks: orphanAuditLinks.length === 0,
      noOrphanActivities: orphanActivities.length === 0,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const allOk = Object.values(report.integrityChecks).every(Boolean);
  process.exit(allOk ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(2);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
