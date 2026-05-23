/**
 * Removes development-only artifacts from the database (preview invoices,
 * TTLock placeholder events, refund stubs). Does NOT delete organizations,
 * users, properties, or reservations.
 *
 * Usage: node scripts/purge-demo-artifacts.mjs
 * Dry run: node scripts/purge-demo-artifacts.mjs --dry-run
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const dryRun = process.argv.includes("--dry-run");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const previewInvoices = await db.billingInvoice.findMany({
    where: { externalRef: { startsWith: "pragma-preview-" } },
    select: { id: true, externalRef: true },
  });

  const placeholderEvents = await db.accessEvent.findMany({
    where: {
      payload: {
        path: ["mode"],
        equals: "placeholder_ready_for_api",
      },
    },
    select: { id: true },
  });

  const placeholderRefunds = await db.paymentRefund.findMany({
    where: {
      metadata: {
        path: ["placeholder"],
        equals: true,
      },
    },
    select: { id: true },
  });

  console.log("Artifacts found:", {
    previewInvoices: previewInvoices.length,
    placeholderAccessEvents: placeholderEvents.length,
    placeholderRefunds: placeholderRefunds.length,
    dryRun,
  });

  if (dryRun) {
    if (previewInvoices.length) {
      console.log(
        "Preview invoices:",
        previewInvoices.map((i) => i.externalRef).join(", "),
      );
    }
    return;
  }

  if (previewInvoices.length) {
    await db.billingInvoice.deleteMany({
      where: { id: { in: previewInvoices.map((i) => i.id) } },
    });
  }

  if (placeholderEvents.length) {
    await db.accessEvent.deleteMany({
      where: { id: { in: placeholderEvents.map((e) => e.id) } },
    });
  }

  if (placeholderRefunds.length) {
    await db.paymentRefund.deleteMany({
      where: { id: { in: placeholderRefunds.map((r) => r.id) } },
    });
  }

  console.log("Purge complete.");
}

main()
  .catch((error) => {
    console.error("Purge failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
