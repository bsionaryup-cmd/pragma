/**
 * Local verification (no deploy): start + end impersonation against prod DB
 * using the owner user row. Does not call Clerk HTTP.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

delete process.env.DATABASE_URL;
process.env.PRAGMA_WEB_BUILDER_STAGING = "0";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const PILOT_ORG = "cmplxfg0a000105jrs0gqtwyc";

async function main() {
  const { db } = await import("@/lib/db");
  const { isSuperAdminOwner } = await import("@/lib/platform/platform-owner");
  const {
    startTenantImpersonation,
    endTenantImpersonation,
  } = await import("@/services/platform/tenant-impersonation.service");
  const {
    createImpersonationCookieValue,
    parseImpersonationCookieValue,
  } = await import("@/lib/platform/impersonation-cookie");

  const owner = await db.user.findFirst({
    where: { platformRole: "SUPER_ADMIN_OWNER", isActive: true },
  });
  if (!owner) {
    throw new Error("No SUPER_ADMIN_OWNER active user found");
  }
  if (!isSuperAdminOwner(owner)) {
    throw new Error(`Owner email/role mismatch for ${owner.email}`);
  }

  const started = await startTenantImpersonation(owner, PILOT_ORG);
  const cookie = createImpersonationCookieValue(started.sessionId);
  const parsed = parseImpersonationCookieValue(cookie);
  if (parsed !== started.sessionId) {
    throw new Error("Cookie round-trip failed");
  }

  const session = await db.platformImpersonationSession.findUnique({
    where: { id: started.sessionId },
  });
  if (!session || session.status !== "ACTIVE") {
    throw new Error("Session not ACTIVE after start");
  }

  await endTenantImpersonation(owner, started.sessionId, "audit_cleanup");
  const ended = await db.platformImpersonationSession.findUnique({
    where: { id: started.sessionId },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        ownerEmail: owner.email,
        organizationName: started.organizationName,
        sessionId: started.sessionId,
        cookieOk: true,
        endedStatus: ended?.status ?? null,
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
