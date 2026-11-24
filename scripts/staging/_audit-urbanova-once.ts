import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.staging"), override: true });
execSync("node scripts/staging/assert-staging-db.mjs", {
  stdio: "inherit",
  env: process.env,
});

async function main() {
  const { db } = await import("@/lib/db");

  const site = await db.tenantWebSite.findUnique({
    where: { slug: "urbanovaloft" },
    include: {
      propertyLinks: {
        include: {
          property: {
            select: {
              id: true,
              name: true,
              unitNumber: true,
              status: true,
              icalUrl: true,
            },
          },
        },
      },
      pages: { select: { id: true, slug: true, status: true, isVisible: true } },
    },
  });

  const migrations = await db.$queryRawUnsafe<
    Array<{ migration_name: string }>
  >(
    `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name LIKE '%web_builder%' OR migration_name LIKE '%20260823%' ORDER BY finished_at DESC NULLS LAST LIMIT 5`,
  );

  console.log(
    JSON.stringify(
      {
        site: site
          ? {
              status: site.status,
              bookingEnabled: site.bookingEnabled,
              organizationId: site.organizationId,
              links: site.propertyLinks.map((l) => ({
                isPublished: l.isPublished,
                unit: l.property.unitNumber,
                propStatus: l.property.status,
                icalUrl: l.property.icalUrl ? "SET" : null,
              })),
              pages: site.pages,
            }
          : null,
        webBuilderMigrations: migrations,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
