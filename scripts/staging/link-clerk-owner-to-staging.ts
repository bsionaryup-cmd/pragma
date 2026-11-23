/**
 * Links the configured Clerk user (by email) to the synthetic staging org as ADMIN.
 * Staging only.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.staging"), override: true });

execSync("node scripts/staging/assert-staging-db.mjs", {
  stdio: "inherit",
  env: process.env,
});

const STAGING_ORG_ID = "stg_web_builder_org_001";
const email =
  process.env.STAGING_ADMIN_EMAIL?.trim().toLowerCase() ||
  process.env.NEXT_PUBLIC_PLATFORM_OWNER_EMAIL?.trim().toLowerCase() ||
  "bsionaryup@gmail.com";

async function main() {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY missing in .env.staging");

  const clerk = createClerkClient({ secretKey: secret });
  const list = await clerk.users.getUserList({ emailAddress: [email], limit: 5 });
  const clerkUser = list.data[0];
  if (!clerkUser) {
    throw new Error(`No Clerk user for ${email}`);
  }

  const { db } = await import("@/lib/db");
  const { UserRole } = await import("@prisma/client");

  const org = await db.organization.findUnique({ where: { id: STAGING_ORG_ID } });
  if (!org) throw new Error("Run staging:seed first");

  // Detach synthetic seed owner so unique account-owner constraint is free.
  await db.user.updateMany({
    where: { organizationId: org.id, isAccountOwner: true },
    data: { isAccountOwner: false, organizationId: null },
  });

  const existingByClerk = await db.user.findUnique({
    where: { clerkId: clerkUser.id },
  });
  const existingByEmail = await db.user.findUnique({ where: { email } });

  const user = existingByClerk
    ? await db.user.update({
        where: { id: existingByClerk.id },
        data: {
          email,
          role: UserRole.ADMIN,
          isAccountOwner: true,
          organizationId: org.id,
          deletedAt: null,
          isActive: true,
          platformRole: "SUPER_ADMIN_OWNER",
        },
      })
    : existingByEmail
      ? await db.user.update({
          where: { id: existingByEmail.id },
          data: {
            clerkId: clerkUser.id,
            role: UserRole.ADMIN,
            isAccountOwner: true,
            organizationId: org.id,
            deletedAt: null,
            isActive: true,
            platformRole: "SUPER_ADMIN_OWNER",
          },
        })
      : await db.user.create({
          data: {
            clerkId: clerkUser.id,
            email,
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            imageUrl: clerkUser.imageUrl,
            role: UserRole.ADMIN,
            isAccountOwner: true,
            organizationId: org.id,
            platformRole: "SUPER_ADMIN_OWNER",
          },
        });


  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        userId: user.id,
        organizationId: org.id,
        clerkIdPrefix: clerkUser.id.slice(0, 8),
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
