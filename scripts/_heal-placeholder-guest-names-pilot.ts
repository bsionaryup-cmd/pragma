/**
 * Heal GR-locked Airbnb placeholders from trusted enrichment (pilot org).
 *   npx tsx scripts/_heal-placeholder-guest-names-pilot.ts
 */
import { config } from "dotenv";
import { PILOT_PMS_ORGANIZATION_ID } from "../src/lib/platform/constants.client";
import { runPlaceholderGuestNameBackfillJob } from "../src/modules/airbnb-email/repair/run-placeholder-guest-name-backfill-job";

config();
config({ path: ".env.local", override: true });

async function main() {
  const orgId =
    process.env.PILOT_PMS_ORGANIZATION_ID?.trim() || PILOT_PMS_ORGANIZATION_ID;
  const dry = await runPlaceholderGuestNameBackfillJob({
    organizationId: orgId,
    limit: 40,
    dryRun: true,
  });
  console.log("dryRun", JSON.stringify(dry, null, 2));
  if (dry.applied === 0) {
    console.log("Nothing to heal.");
    return;
  }
  const live = await runPlaceholderGuestNameBackfillJob({
    organizationId: orgId,
    limit: 40,
    dryRun: false,
  });
  console.log("applied", JSON.stringify(live, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
