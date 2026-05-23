import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const email = (process.argv[2] ?? "daydianarodriguez@gmail.com").trim().toLowerCase();
const DEMO_ORG_NAME = "PRAGMA Demo · Urbano Loft";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const organization = await db.organization.findFirst({
  where: { name: DEMO_ORG_NAME },
  select: { id: true, name: true },
});

if (!organization) {
  console.error("Demo org not found");
  process.exit(1);
}

const user = await db.user.findFirst({
  where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
});

if (!user) {
  console.error(`User not found: ${email}`);
  process.exit(1);
}

const updated = await db.user.update({
  where: { id: user.id },
  data: {
    organizationId: organization.id,
    role: "ADMIN",
    isAccountOwner: false,
    isActive: true,
    deletedAt: null,
    onboardingCompletedAt: user.onboardingCompletedAt ?? new Date(),
    companyName: user.companyName ?? "Urbano Loft",
  },
});

await clerk.users.updateUser(updated.clerkId, {
  publicMetadata: {
    role: updated.role,
    dbUserId: updated.id,
  },
});

console.log(
  JSON.stringify(
    {
      ok: true,
      email: updated.email,
      role: updated.role,
      organization: organization.name,
      organizationId: organization.id,
      isAccountOwner: updated.isAccountOwner,
    },
    null,
    2,
  ),
);

await db.$disconnect();
await pool.end();
