/**
 * Ensures minimal platform bootstrap records after pilot-reset.
 * NEVER modifies the platform owner user.
 *
 * Creates (if missing):
 * - Organization "PRAGMA Platform (Wompi)" (SaaS Wompi credential store)
 *
 * Usage:
 *   node scripts/ensure-platform-bootstrap.mjs
 *   node scripts/ensure-platform-bootstrap.mjs --dry-run
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const dryRun = process.argv.includes("--dry-run");
const PLATFORM_OWNER_EMAIL =
  process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || "bsionaryup@gmail.com";
const PLATFORM_WOMPI_ORG_NAME = "PRAGMA Platform (Wompi)";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const owner = await db.user.findFirst({
    where: {
      email: PLATFORM_OWNER_EMAIL,
      platformRole: "SUPER_ADMIN_OWNER",
    },
    select: {
      id: true,
      email: true,
      platformRole: true,
      organizationId: true,
      isActive: true,
      deletedAt: true,
      clerkId: true,
    },
  });

  if (!owner) {
    throw new Error(
      `Platform owner missing (${PLATFORM_OWNER_EMAIL} + SUPER_ADMIN_OWNER). Aborting.`,
    );
  }

  let platformOrg = await db.organization.findFirst({
    where: { name: PLATFORM_WOMPI_ORG_NAME },
    select: { id: true, name: true },
  });

  if (!platformOrg && !dryRun) {
    platformOrg = await db.organization.create({
      data: { name: PLATFORM_WOMPI_ORG_NAME },
      select: { id: true, name: true },
    });
  }

  const wompiIntegration = platformOrg
    ? await db.wompiIntegration.findUnique({
        where: { organizationId: platformOrg.id },
        select: { id: true, enabled: true, publicKey: true },
      })
    : null;

  const tenantOrgCount = await db.organization.count({
    where: platformOrg ? { id: { not: platformOrg.id } } : undefined,
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        owner: {
          id: owner.id,
          email: owner.email,
          platformRole: owner.platformRole,
          organizationId: owner.organizationId,
          isActive: owner.isActive,
          deletedAt: owner.deletedAt,
        },
        platformOrg: platformOrg ?? { wouldCreate: PLATFORM_WOMPI_ORG_NAME },
        wompiIntegration: wompiIntegration
          ? {
              id: wompiIntegration.id,
              enabled: wompiIntegration.enabled,
              hasPublicKey: Boolean(wompiIntegration.publicKey),
            }
          : null,
        tenantOrganizations: tenantOrgCount,
        note:
          "Per-tenant BillingAccount rows are created on signup/onboarding; legacy singleton billing is not required.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Bootstrap failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
