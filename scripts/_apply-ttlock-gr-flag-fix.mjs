import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Clear failed migration record if present, then apply SQL manually and mark applied.
  await db.$executeRawUnsafe(`
    DELETE FROM "_prisma_migrations"
    WHERE migration_name = '20260727010000_ttlock_generate_after_gr_default_true'
      AND finished_at IS NULL
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "ttlock_automation_settings"
      ALTER COLUMN "generateAfterGuestRegistration" SET DEFAULT true
  `);

  const updated = await db.$executeRawUnsafe(`
    UPDATE "ttlock_automation_settings"
    SET "generateAfterGuestRegistration" = true
    WHERE "generateAfterGuestRegistration" = false
  `);

  console.log(JSON.stringify({ updatedRows: updated }));

  // Mark migration applied via prisma migrate resolve
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
