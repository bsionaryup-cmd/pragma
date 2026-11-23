/**
 * Read-only DB acceptance audit for WEB BUILDER.
 * Usage: npx tsx --require ./scripts/_mock-server-only.cjs scripts/_audit-web-builder-acceptance-db.ts
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

function maskUrl(raw: string | undefined): string {
  if (!raw) return "(missing)";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}${u.search}`;
  } catch {
    return "(unparseable)";
  }
}

async function main() {
  const { db } = await import("@/lib/db");
  const { PILOT_PMS_ORGANIZATION_ID } = await import(
    "@/lib/platform/constants.client"
  );

  const databaseUrl = process.env.DATABASE_URL;
  const host = (() => {
    try {
      return databaseUrl ? new URL(databaseUrl).host : null;
    } catch {
      return null;
    }
  })();

  const migrations = await db.$queryRawUnsafe<
    Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
  >(
    `SELECT migration_name, finished_at, rolled_back_at
     FROM "_prisma_migrations"
     ORDER BY finished_at DESC NULLS LAST
     LIMIT 15`,
  );

  const webTables = await db.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name LIKE 'tenant_web%'
     ORDER BY table_name`,
  );

  const webEnums = await db.$queryRawUnsafe<Array<{ typname: string }>>(
    `SELECT typname FROM pg_type
     WHERE typname IN (
       'WebSiteStatus','WebSiteTemplate','WebMediaCategory',
       'WebMediaProvenance','WebContentReviewStatus'
     )
     ORDER BY typname`,
  );

  const sites = await db.tenantWebSite.findMany({
    select: {
      id: true,
      organizationId: true,
      slug: true,
      status: true,
      siteName: true,
      template: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { propertyLinks: true, pages: true, media: true },
      },
    },
  });

  const orgIds = [...new Set(sites.map((s) => s.organizationId))];
  const orgs = await db.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, status: true },
  });

  const pilotProps = await db.property.findMany({
    where: {
      organizationId: PILOT_PMS_ORGANIZATION_ID,
      status: "ACTIVE",
    },
    select: { id: true, name: true, unitNumber: true },
    orderBy: [{ unitNumber: "asc" }, { name: "asc" }],
  });

  const webBuilderReservations = await db.reservation.findMany({
    where: {
      internalNotes: { contains: "[WEB_BUILDER]" },
    },
    select: {
      id: true,
      propertyId: true,
      checkIn: true,
      checkOut: true,
      status: true,
      platform: true,
      createdAt: true,
      property: {
        select: { organizationId: true, unitNumber: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const orgCount = await db.organization.count();
  const reservationCount = await db.reservation.count();
  const propertyCount = await db.property.count();

  // Heuristic: production-like if many orgs/reservations and host matches known prod neon
  const signals = {
    host,
    maskedDatabaseUrl: maskUrl(databaseUrl),
    organizationCount: orgCount,
    propertyCount,
    reservationCount,
    looksLikeSharedOperationalDb:
      orgCount >= 3 && reservationCount >= 50,
  };

  console.log(
    JSON.stringify(
      {
        connection: signals,
        recentMigrations: migrations,
        webTables,
        webEnums,
        pilotOrganizationId: PILOT_PMS_ORGANIZATION_ID,
        sites,
        orgs,
        pilotActiveProperties: pilotProps,
        webBuilderReservations,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
