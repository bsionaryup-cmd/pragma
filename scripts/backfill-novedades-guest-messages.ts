/**
 * Backfill mensajes huésped: re-fetch Resend + rebuild actividades.
 * npx tsx scripts/backfill-novedades-guest-messages.ts [--orgId=...]
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  ensureLinkedGuestMessageActivities,
  rebuildGuestMessageActivityFromAudit,
  repairUnparseableGuestMessageActivities,
} from "@/modules/reservation-activity/services/repair-guest-message-bodies";
import { resolveGuestMessageBodiesForDisplay } from "@/services/novedades/operational-feed.message";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

async function main() {
  const orgId = readArg("orgId") ?? "cmplxfg0a000105jrs0gqtwyc";
  const scope = { organizationId: orgId, userId: "backfill-script" };

  console.log("Repairing unparseable guest message activities...");
  console.log("repaired:", await repairUnparseableGuestMessageActivities(scope));

  console.log("Ensuring linked audits have activities...");
  console.log("created:", await ensureLinkedGuestMessageActivities(scope));

  const karlaId = "cmpnc1v7e000004juw7z33cz8";
  const latestAudit = "cmqjvt0k0000004jx2fmohw9z";
  console.log("Force rebuild latest Karla audit:", await rebuildGuestMessageActivityFromAudit(latestAudit));

  const activities = await db.reservationActivity.findMany({
    where: { reservationId: karlaId, activityType: "AIRBNB_MESSAGE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, content: true, metadataJson: true, senderName: true, createdAt: true },
  });

  console.log("\nKarla timeline after backfill:");
  for (const a of activities) {
    const raw = (a.metadataJson as { rawMessageBody?: string } | null)?.rawMessageBody;
    const bodies = resolveGuestMessageBodiesForDisplay(raw ?? a.content, {
      guestName: a.senderName ?? "Karla",
    });
    console.log({
      at: a.createdAt.toISOString(),
      bodies: bodies.length,
      preview: bodies[bodies.length - 1]?.slice(0, 100) ?? "(empty)",
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
