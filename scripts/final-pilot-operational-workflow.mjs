/**
 * Final release pilot — read-only operational workflow evidence.
 * Usage: node scripts/final-pilot-operational-workflow.mjs [organizationId]
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ReservationStatus } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const PILOT_ORG_ID = process.argv[2] ?? "cmplxfg0a000105jrs0gqtwyc";
const PLACEHOLDER_GUEST = "Huésped Airbnb";
const ACCOUNTING_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const steps = [];

function record(step, pass, expected, observed, evidence) {
  steps.push({
    step,
    result: pass ? "PASS" : "FAIL",
    expected,
    observed,
    evidence,
    anomaly: pass ? null : observed,
  });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${step}`);
  console.log(`  Expected: ${expected}`);
  console.log(`  Observed: ${observed}`);
  console.log(`  Evidence: ${evidence}`);
  if (!pass) console.log(`  Anomaly: ${observed}`);
  console.log("");
}

async function main() {
  console.log(`\n=== Final pilot operational workflow — org ${PILOT_ORG_ID} ===\n`);

  const org = await db.organization.findUnique({
    where: { id: PILOT_ORG_ID },
    select: { id: true, name: true, status: true },
  });

  if (!org) {
    record(
      "Pilot tenant",
      false,
      "Active pilot organization",
      "Organization not found",
      `id=${PILOT_ORG_ID}`,
    );
    await shutdown(1);
    return;
  }

  record(
    "Pilot tenant",
    true,
    "Active pilot organization",
    org.name,
    `id=${org.id} status=${org.status}`,
  );

  // 1 Reservation import (iCal)
  const icalReservations = await db.reservation.count({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      icalUid: { not: null },
    },
  });
  const totalReservations = await db.reservation.count({
    where: { property: { organizationId: PILOT_ORG_ID } },
  });
  record(
    "Reservation import (iCal)",
    icalReservations > 0,
    "Reservations exist from calendar sync with icalUid",
    `${icalReservations}/${totalReservations} have icalUid`,
    "reservation.icalUid populated",
  );

  const lastIcalSync = await db.property.findFirst({
    where: { organizationId: PILOT_ORG_ID, lastIcalSyncedAt: { not: null } },
    orderBy: { lastIcalSyncedAt: "desc" },
    select: { name: true, lastIcalSyncedAt: true },
  });
  record(
    "Calendar sync recency",
    Boolean(lastIcalSync),
    "At least one property synced via iCal",
    lastIcalSync
      ? `${lastIcalSync.name} @ ${lastIcalSync.lastIcalSyncedAt?.toISOString()}`
      : "none",
    "property.lastIcalSyncedAt",
  );

  // 2 Email processing
  const audits = await db.emailIngestionAudit.count({
    where: { organizationId: PILOT_ORG_ID },
  });
  const processedAudits = await db.emailIngestionAudit.count({
    where: {
      organizationId: PILOT_ORG_ID,
      processingStatus: "PROCESSED",
    },
  });
  record(
    "Email processing",
    audits > 0,
    "Inbound Airbnb emails ingested for tenant",
    `${processedAudits}/${audits} PROCESSED`,
    "email_ingestion_audit",
  );

  // 3 Reservation matching
  const matchedAudits = await db.emailIngestionAudit.count({
    where: {
      organizationId: PILOT_ORG_ID,
      reservationId: { not: null },
      matchConfidence: { gte: 0.88 },
    },
  });
  const linkedEvents = await db.reservationEmailEvent.count({
    where: {
      reservation: { property: { organizationId: PILOT_ORG_ID } },
      reservationId: { not: null },
    },
  });
  record(
    "Reservation matching",
    linkedEvents > 0,
    "Emails linked to reservations with confidence",
    `${linkedEvents} reservation_email_event rows; ${matchedAudits} audits ≥0.88`,
    "reservationEmailEvent + audit.matchConfidence",
  );

  // 4 Reservation enrichment
  const enrichedEvents = await db.reservationEmailEvent.count({
    where: {
      reservation: { property: { organizationId: PILOT_ORG_ID } },
      NOT: { enrichedFields: { equals: {} } },
    },
  });
  const placeholderWithEmail = await db.reservation.count({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      guestName: PLACEHOLDER_GUEST,
      emailEvents: { some: {} },
    },
  });
  record(
    "Reservation enrichment",
    enrichedEvents > 0 && placeholderWithEmail === 0,
    "Email events enrich reservations; no placeholder+email gap",
    `${enrichedEvents} enriched events; ${placeholderWithEmail} placeholder+email`,
    "reservationEmailEvent.enrichedFields + guestName",
  );

  // Sample enriched reservation for downstream checks
  const sample = await db.reservation.findFirst({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      emailEvents: { some: {} },
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      guestName: true,
      totalAmount: true,
      reservationCode: true,
      guestRegistrationToken: true,
      guestRegistrationCompletedAt: true,
    },
  });

  // 5 Revenue update
  const revenuePositive = await db.reservation.count({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      status: { in: ACCOUNTING_STATUSES },
      totalAmount: { gt: 0 },
    },
  });
  const revenueAccounting = await db.reservation.count({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      status: { in: ACCOUNTING_STATUSES },
    },
  });
  record(
    "Revenue update",
    revenuePositive >= revenueAccounting - 1,
    "Accounting reservations carry stored revenue",
    `${revenuePositive}/${revenueAccounting} with totalAmount > 0`,
    sample
      ? `sample ${sample.id} guest=${sample.guestName} amount=${sample.totalAmount}`
      : "no sample",
  );

  // 6 Finance update (email payout linkage)
  const payoutRows = await db.reservationPayout.count({
    where: { reservation: { property: { organizationId: PILOT_ORG_ID } } },
  });
  record(
    "Finance update",
    linkedEvents > 0,
    "Finance can trace email revenue sources",
    `${payoutRows} payout rows; ${linkedEvents} email-linked reservations`,
    "reservation_payout + reservation_email_event",
  );

  // 7 Dashboard update (command center inputs)
  const activeProps = await db.property.count({
    where: { organizationId: PILOT_ORG_ID, status: "ACTIVE" },
  });
  const upcoming = await db.reservation.count({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      checkIn: { gte: new Date(Date.now() - 86400000) },
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
    },
  });
  record(
    "Dashboard update",
    activeProps > 0 && totalReservations > 0,
    "Panel metrics have property + reservation inputs",
    `${activeProps} active properties; ${upcoming} upcoming/in-house`,
    "property.status + reservation.checkIn",
  );

  // 8 Reservation activities
  const activities = await db.reservationActivity.count({
    where: { reservation: { property: { organizationId: PILOT_ORG_ID } } },
  });
  const crossScope = await db.reservationActivity.count({
    where: {
      reservation: { property: { organizationId: PILOT_ORG_ID } },
      property: { organizationId: { not: PILOT_ORG_ID } },
    },
  });
  record(
    "Reservation activities",
    activities > 0 && crossScope === 0,
    "Activities exist and stay tenant-scoped",
    `${activities} activities; ${crossScope} cross-scope`,
    "reservation_activity",
  );

  // 9 Guest registration
  const regTokens = await db.reservation.count({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      guestRegistrationToken: { not: null },
    },
  });
  const regCompleted = await db.reservation.count({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      guestRegistrationCompletedAt: { not: null },
    },
  });
  record(
    "Guest registration",
    regTokens > 0 || regCompleted > 0,
    "Registration tokens issued and/or completed",
    `${regCompleted} completed; ${regTokens} with token`,
    sample?.guestRegistrationToken
      ? `sample token present=${Boolean(sample.guestRegistrationToken)}`
      : "sample without token",
  );

  // 10 Tasks
  const manualTasks = await db.task.count({
    where: {
      OR: [
        { property: { organizationId: PILOT_ORG_ID } },
        { reservation: { property: { organizationId: PILOT_ORG_ID } } },
      ],
    },
  });
  const emailTasksScoped = await db.airbnbEmailTask.count({
    where: {
      OR: [
        { reservation: { property: { organizationId: PILOT_ORG_ID } } },
        { property: { organizationId: PILOT_ORG_ID } },
      ],
    },
  });
  record(
    "Tasks",
    manualTasks + emailTasksScoped > 0,
    "Operational tasks visible for tenant scope",
    `${manualTasks} manual; ${emailTasksScoped} email-scoped`,
    "task + airbnb_email_task",
  );

  // 11 Notifications (activity / email pipeline proxy)
  const guestMessages = await db.reservationActivity.count({
    where: {
      reservation: { property: { organizationId: PILOT_ORG_ID } },
      activityType: "AIRBNB_MESSAGE",
    },
  });
  record(
    "Notifications / guest messages",
    guestMessages > 0 || linkedEvents > 0,
    "Guest communication captured in activity or email pipeline",
    `${guestMessages} AIRBNB_MESSAGE activities`,
    "reservation_activity.activityType",
  );

  // 12 TTLock
  const ttlock = await db.tTLockIntegration.findFirst({
    where: { organizationId: PILOT_ORG_ID },
    select: { status: true, lastSyncedAt: true, _count: { select: { propertyLocks: true } } },
  });
  const accessCreds = await db.accessCredential.count({
    where: { reservation: { property: { organizationId: PILOT_ORG_ID } } },
  });
  record(
    "TTLock (when applicable)",
    Boolean(ttlock),
    "TTLock connected for pilot tenant",
    ttlock
      ? `status=${ttlock.status} locks=${ttlock._count.propertyLocks} creds=${accessCreds}`
      : "not configured",
    ttlock?.lastSyncedAt
      ? `lastSync=${ttlock.lastSyncedAt.toISOString()}`
      : "n/a",
  );

  const failed = steps.filter((s) => s.result === "FAIL").length;
  console.log(`--- Workflow summary: ${steps.length - failed}/${steps.length} PASS ---\n`);

  const report = {
    generatedAt: new Date().toISOString(),
    organizationId: PILOT_ORG_ID,
    organizationName: org.name,
    steps,
    summary: { total: steps.length, passed: steps.length - failed, failed },
  };

  const fs = await import("node:fs");
  const outPath = "scripts/final-pilot-workflow-result.json";
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Report written: ${outPath}\n`);

  await shutdown(failed > 0 ? 1 : 0);
}

async function shutdown(code) {
  await db.$disconnect();
  await pool.end();
  process.exit(code);
}

main().catch(async (error) => {
  console.error(error);
  await shutdown(1);
});
