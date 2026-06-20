/**
 * Backfill conservador: guestName "Huésped Airbnb" → nombre en enrichedFields.
 *
 *   npx tsx scripts/run-placeholder-guest-name-backfill.ts [organizationId] [--dry-run]
 */
import { config } from "dotenv";
import { runPlaceholderGuestNameBackfillJob } from "@/modules/airbnb-email/repair/run-placeholder-guest-name-backfill-job";

config();
config({ path: ".env.local", override: true });

const orgId = process.argv[2]?.trim();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const result = await runPlaceholderGuestNameBackfillJob({
    organizationId: orgId,
    limit: 200,
    dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
