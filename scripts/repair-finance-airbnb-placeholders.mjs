/**
 * Backfill Airbnb placeholder guest names + reservation codes from email enrichment.
 * Usage: node scripts/repair-finance-airbnb-placeholders.mjs [--dry-run]
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG_ID = process.env.AUDIT_ORG_ID ?? "cmplxfg0a000105jrs0gqtwyc";
const dryRun = process.argv.includes("--dry-run");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function splitGuestName(fullName) {
  const guestName = fullName.trim().replace(/\s+/g, " ");
  const parts = guestName.split(/\s+/);
  return {
    guestName,
    guestFirstName: parts[0] ?? guestName,
    guestLastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function readGuestFromEnriched(enriched) {
  if (!enriched || typeof enriched !== "object" || Array.isArray(enriched)) {
    return null;
  }
  const name = enriched.guestName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

async function main() {
  const rows = await db.reservation.findMany({
    where: {
      property: { organizationId: ORG_ID },
      platform: "AIRBNB",
      guestName: "Huésped Airbnb",
    },
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      totalAmount: true,
      checkIn: true,
    },
  });

  console.log("placeholder rows:", rows.length, dryRun ? "(dry-run)" : "");

  for (const row of rows) {
    const events = await db.reservationEmailEvent.findMany({
      where: { reservationId: row.id },
      select: {
        eventKind: true,
        confirmationCode: true,
        enrichedFields: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let guestFromEmail = null;
    let codeFromEmail = null;
    for (const event of events) {
      if (!guestFromEmail) {
        guestFromEmail = readGuestFromEnriched(event.enrichedFields);
      }
      if (!codeFromEmail && event.confirmationCode?.trim()) {
        codeFromEmail = event.confirmationCode.trim();
      }
    }

    const updates = {};
    if (guestFromEmail) {
      Object.assign(updates, splitGuestName(guestFromEmail));
    }
    if (codeFromEmail && !row.reservationCode?.trim()) {
      updates.reservationCode = codeFromEmail;
    }

    if (Object.keys(updates).length === 0) {
      console.log("skip", row.id, row.checkIn.toISOString().slice(0, 10));
      continue;
    }

    console.log("repair", {
      id: row.id,
      checkIn: row.checkIn.toISOString().slice(0, 10),
      totalAmount: Number(row.totalAmount),
      updates,
    });

    if (!dryRun) {
      await db.reservation.update({
        where: { id: row.id },
        data: updates,
      });
    }
  }
}

main()
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
