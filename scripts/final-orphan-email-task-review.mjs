/**
 * Orphan AirbnbEmailTask backlog review — read-only.
 * Usage: node scripts/final-orphan-email-task-review.mjs [organizationId]
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const PILOT_ORG_ID = process.argv[2] ?? "cmplxfg0a000105jrs0gqtwyc";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log(`\n=== Orphan email task review — org ${PILOT_ORG_ID} ===\n`);

  const byKind = await db.airbnbEmailTask.groupBy({
    by: ["kind", "status"],
    where: {
      reservationId: null,
      propertyId: null,
      audit: { organizationId: PILOT_ORG_ID },
    },
    _count: true,
    orderBy: { kind: "asc" },
  });

  console.log("By kind (reservationId=null, propertyId=null):");
  for (const row of byKind) {
    console.log(`  ${row.kind} / ${row.status}: ${row._count}`);
  }

  const oldest = await db.airbnbEmailTask.findMany({
    where: {
      reservationId: null,
      propertyId: null,
      audit: { organizationId: PILOT_ORG_ID },
    },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: {
      id: true,
      kind: true,
      title: true,
      createdAt: true,
      audit: {
        select: {
          subject: true,
          processingStatus: true,
          matchConfidence: true,
          errorReason: true,
        },
      },
    },
  });

  console.log("\nOldest samples:");
  for (const task of oldest) {
    console.log(
      `  [${task.kind}] ${task.createdAt.toISOString().slice(0, 10)} — ${task.title}`,
    );
    console.log(
      `    audit: ${task.audit?.processingStatus} conf=${task.audit?.matchConfidence ?? "null"} subject=${(task.audit?.subject ?? "").slice(0, 60)}`,
    );
    if (task.audit?.errorReason) {
      console.log(`    error: ${task.audit.errorReason.slice(0, 80)}`);
    }
  }

  const recoverable = await db.airbnbEmailTask.count({
    where: {
      reservationId: null,
      propertyId: null,
      kind: "MANUAL_REVIEW",
      audit: {
        organizationId: PILOT_ORG_ID,
        reservationId: { not: null },
      },
    },
  });

  const stale90d = await db.airbnbEmailTask.count({
    where: {
      reservationId: null,
      propertyId: null,
      audit: { organizationId: PILOT_ORG_ID },
      createdAt: { lt: new Date(Date.now() - 90 * 86400000) },
      status: "PENDING",
    },
  });

  const withAuditNoMatch = await db.airbnbEmailTask.count({
    where: {
      reservationId: null,
      propertyId: null,
      audit: {
        organizationId: PILOT_ORG_ID,
        reservationId: null,
        processingStatus: "PROCESSED",
      },
    },
  });

  console.log("\nClassification signals:");
  console.log(`  Audits later matched but task still orphan: ${recoverable}`);
  console.log(`  Pending orphans older than 90d: ${stale90d}`);
  console.log(`  PROCESSED audit, no reservation link: ${withAuditNoMatch}`);

  const conclusion = {
    organizationId: PILOT_ORG_ID,
    totals: byKind,
    classification: {
      expectedManualReview:
        byKind.find((r) => r.kind === "MANUAL_REVIEW")?._count ?? 0,
      expectedOrphanEvents:
        byKind.find((r) => r.kind === "ORPHAN_EMAIL_EVENT")?._count ?? 0,
      payoutMismatch:
        byKind.find((r) => r.kind === "PAYOUT_MISMATCH")?._count ?? 0,
      recoverableBacklog: recoverable,
      staleData: stale90d,
      productDefect: recoverable > 0 ? recoverable : 0,
    },
    recommendation:
      recoverable > 0
        ? "Run enrichment retry / relink job for tasks whose audit gained reservationId"
        : "Backlog is expected unmatched-mail manual review; triage via ops, optional 90d archive policy",
  };

  console.log("\nConclusion:");
  console.log(JSON.stringify(conclusion, null, 2));

  const fs = await import("node:fs");
  fs.writeFileSync(
    "scripts/final-orphan-task-review.json",
    JSON.stringify(conclusion, null, 2),
  );

  await db.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
