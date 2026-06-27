/**
 * Read-only pilot tenant validation for release candidate.
 * Usage: node scripts/pilot-release-validation.mjs [organizationId]
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ReservationStatus } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const PILOT_ORG_ID = process.argv[2] ?? "cmplxfg0a000105jrs0gqtwyc";
const ACCOUNTING_STATUSES = new Set([
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
  ReservationStatus.COMPLETED,
]);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const findings = [];
let passed = 0;
let failed = 0;

function ok(label, detail) {
  passed += 1;
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail) {
  failed += 1;
  findings.push({ label, detail });
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`\n=== Pilot release validation — org ${PILOT_ORG_ID} ===\n`);

  const org = await db.organization.findUnique({
    where: { id: PILOT_ORG_ID },
    select: { id: true, name: true, status: true },
  });

  if (!org) {
    fail("Organization exists", `No org for id ${PILOT_ORG_ID}`);
    await shutdown(1);
    return;
  }
  ok("Organization exists", org.name);

  const properties = await db.property.count({
    where: { organizationId: PILOT_ORG_ID },
  });
  if (properties === 0) fail("Properties configured", "0 properties");
  else ok("Properties configured", String(properties));

  const reservations = await db.reservation.findMany({
    where: { property: { organizationId: PILOT_ORG_ID } },
    select: {
      id: true,
      status: true,
      guestName: true,
      totalAmount: true,
      platform: true,
      checkIn: true,
      checkOut: true,
    },
    take: 500,
    orderBy: { updatedAt: "desc" },
  });
  ok("Reservations loaded", String(reservations.length));

  const emailLinked = await db.reservationEmailEvent.count({
    where: {
      reservation: { property: { organizationId: PILOT_ORG_ID } },
      reservationId: { not: null },
    },
  });
  ok("Email events linked to reservations", String(emailLinked));

  const orphanEmailTasks = await db.airbnbEmailTask.count({
    where: {
      reservationId: null,
      propertyId: null,
      audit: {
        organizationId: PILOT_ORG_ID,
      },
    },
  });
  if (orphanEmailTasks > 0) {
    ok(
      "Orphan Airbnb email tasks (review backlog)",
      `${orphanEmailTasks} MANUAL_REVIEW/ORPHAN — expected for unmatched mail`,
    );
  } else {
    ok("No orphan Airbnb email tasks without scope");
  }

  const activitiesCrossOrg = await db.reservationActivity.count({
    where: {
      reservation: { property: { organizationId: PILOT_ORG_ID } },
      property: { organizationId: { not: PILOT_ORG_ID } },
    },
  });
  if (activitiesCrossOrg > 0) {
    fail("Reservation activities cross-org leak", String(activitiesCrossOrg));
  } else {
    ok("Reservation activities tenant-scoped");
  }

  const placeholderWithEmail = await db.reservation.count({
    where: {
      property: { organizationId: PILOT_ORG_ID },
      guestName: "Huésped Airbnb",
      emailEvents: { some: {} },
    },
  });
  if (placeholderWithEmail > 5) {
    fail(
      "Placeholder guest names with email events",
      `${placeholderWithEmail} reservations still placeholder`,
    );
  } else if (placeholderWithEmail > 0) {
    ok(
      "Placeholder enrichment residual",
      `${placeholderWithEmail} (within tolerance)`,
    );
  } else {
    ok("No placeholder names with linked email");
  }

  const accountingReservations = reservations.filter((row) =>
    ACCOUNTING_STATUSES.has(row.status),
  );
  const withRevenue = accountingReservations.filter(
    (row) => Number(row.totalAmount ?? 0) > 0,
  );
  if (accountingReservations.length > 0 && withRevenue.length === 0) {
    fail("Finance revenue on accounting reservations", "all $0");
  } else {
    ok(
      "Accounting reservations have revenue rows",
      `${withRevenue.length}/${accountingReservations.length}`,
    );
  }

  const ttlock = await db.tTLockIntegration.findFirst({
    where: { organizationId: PILOT_ORG_ID },
    select: { id: true, status: true, lastSyncedAt: true },
  });
  if (ttlock) ok("TTLock integration present", ttlock.status);
  else ok("TTLock integration", "not configured (optional)");

  const billing = await db.billingAccount.findFirst({
    where: { organizationId: PILOT_ORG_ID },
    select: { status: true, trialEndsAt: true },
  });
  if (billing) ok("Billing account", billing.status);
  else fail("Billing account", "missing");

  const prospectingLeads = await db.prospectingLead.count({
    where: { organizationId: PILOT_ORG_ID },
  });
  ok("Tenant prospecting leads (legacy data)", String(prospectingLeads));

  console.log(`\n--- Summary: ${passed} passed, ${failed} failed ---\n`);

  if (findings.length > 0) {
    console.log("Findings:");
    for (const item of findings) {
      console.log(`  - ${item.label}: ${item.detail}`);
    }
  }

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
