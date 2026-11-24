import { config } from "dotenv";
import { resolve } from "node:path";

delete process.env.DATABASE_URL;
process.env.PRAGMA_WEB_BUILDER_STAGING = "0";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const PILOT_ORG = "cmplxfg0a000105jrs0gqtwyc";

async function main() {
  const { db } = await import("@/lib/db");
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/?]+)/)?.[1] ?? "";
  console.log("HOST=" + host);

  const tables = await db.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND (
      tablename ILIKE '%impersonat%' OR tablename ILIKE '%platform%'
    ) ORDER BY 1`,
  );

  let sessionTableOk = false;
  try {
    const count = await db.platformImpersonationSession.count();
    sessionTableOk = true;
    console.log("sessionCount=" + count);
  } catch (e) {
    console.error(
      "SESSION_TABLE_FAIL",
      e instanceof Error ? e.message : e,
    );
  }

  const ownerUsers = await db.user.findMany({
    where: {
      OR: [
        { email: { contains: "bsionary", mode: "insensitive" } },
        { platformRole: "SUPER_ADMIN_OWNER" },
      ],
    },
    select: {
      id: true,
      email: true,
      role: true,
      platformRole: true,
      isActive: true,
      organizationId: true,
      clerkId: true,
    },
    take: 10,
  });

  const org = await db.organization.findUnique({
    where: { id: PILOT_ORG },
    select: { id: true, name: true, status: true },
  });

  const orgUsers = await db.user.findMany({
    where: { organizationId: PILOT_ORG },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      clerkId: true,
    },
    take: 20,
  });

  const hasSecret = Boolean(
    process.env.PLATFORM_IMPERSONATION_SECRET?.trim() ||
      process.env.CLERK_SECRET_KEY?.trim(),
  );

  // Simulate cookie sign/parse round-trip
  const { createImpersonationCookieValue, parseImpersonationCookieValue } =
    await import("@/lib/platform/impersonation-cookie");
  const sampleSession = await db.platformImpersonationSession.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: { id: true, platformUserId: true, targetOrganizationId: true },
  });
  let cookieRoundTripOk = false;
  if (sampleSession) {
    const raw = createImpersonationCookieValue(sampleSession.id);
    cookieRoundTripOk =
      parseImpersonationCookieValue(raw) === sampleSession.id;
  }

  console.log(
    JSON.stringify(
      {
        platformTables: tables.map((t) => t.tablename),
        sessionTableOk,
        hasImpersonationSigningSecret: hasSecret,
        hasPlatformImpersonationSecret: Boolean(
          process.env.PLATFORM_IMPERSONATION_SECRET?.trim(),
        ),
        platformOwnerEmailEnv:
          process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() ?? null,
        ownerUsers,
        org,
        orgUsers,
        latestActiveSession: sampleSession,
        cookieRoundTripOk,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
