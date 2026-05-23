/**
 * Provisions a real Clerk login for the demo tenant (sample data only).
 *
 * Usage:
 *   node scripts/provision-demo-test-user.mjs testpragma@gmail.com "YourPassword"
 *
 * Links the user as ADMIN + account owner of "PRAGMA Demo · Urbano Loft"
 * and removes seed-only DB users (demo@ / recepcion@).
 */
import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const emailArg = process.argv[2]?.trim().toLowerCase();
const passwordArg = process.argv[3];

const DEMO_ORG_NAME = "PRAGMA Demo · Urbano Loft";
const SEED_EMAILS = ["demo@pragmapms.com", "recepcion@pragmapms.com"];

if (!emailArg || !passwordArg) {
  console.error(
    'Usage: node scripts/provision-demo-test-user.mjs <email> "<password>"',
  );
  process.exit(1);
}

if (passwordArg.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

if (!clerk) {
  console.error("CLERK_SECRET_KEY is required.");
  process.exit(1);
}

async function findClerkUserByEmail(email) {
  const list = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 10,
  });
  return (
    list.data.find((user) =>
      user.emailAddresses.some(
        (entry) => entry.emailAddress.toLowerCase() === email.toLowerCase(),
      ),
    ) ?? null
  );
}

async function main() {
  const organization = await db.organization.findFirst({
    where: { name: DEMO_ORG_NAME },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new Error(
      `Demo org not found (${DEMO_ORG_NAME}). Run: npm run db:seed:demo`,
    );
  }

  let clerkUser = await findClerkUserByEmail(emailArg);

  const seedUsers = await db.user.findMany({
    where: {
      email: { in: SEED_EMAILS },
    },
    select: { id: true, clerkId: true, email: true },
  });

  for (const seed of seedUsers) {
    await db.user.update({
      where: { id: seed.id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        isAccountOwner: false,
        organizationId: null,
      },
    });
  }

  if (!clerkUser) {
    clerkUser = await clerk.users.createUser({
      emailAddress: [emailArg],
      password: passwordArg,
      firstName: "Test",
      lastName: "PRAGMA",
      skipPasswordRequirement: false,
      skipPasswordChecks: true,
      publicMetadata: {
        role: "ADMIN",
        dbUserId: "pending",
      },
    });
  } else {
    clerkUser = await clerk.users.updateUser(clerkUser.id, {
      password: passwordArg,
      skipPasswordChecks: true,
      firstName: clerkUser.firstName ?? "Test",
      lastName: clerkUser.lastName ?? "PRAGMA",
    });
  }

  const existing = await db.user.findFirst({
    where: { email: { equals: emailArg, mode: "insensitive" } },
  });

  let user;
  if (existing) {
    user = await db.user.update({
      where: { id: existing.id },
      data: {
        clerkId: clerkUser.id,
        email: emailArg,
        firstName: "Test",
        lastName: "PRAGMA",
        imageUrl: clerkUser.imageUrl || null,
        role: "ADMIN",
        platformRole: "NONE",
        isAccountOwner: true,
        isActive: true,
        deletedAt: null,
        organizationId: organization.id,
        companyName: "Urbano Loft",
        phone: "+57 300 123 4567",
        propertyCount: 4,
        onboardingCompletedAt: new Date(),
        locale: "es",
        timezone: "America/Bogota",
      },
    });
  } else {
    user = await db.user.create({
      data: {
        clerkId: clerkUser.id,
        email: emailArg,
        firstName: "Test",
        lastName: "PRAGMA",
        imageUrl: clerkUser.imageUrl || null,
        role: "ADMIN",
        platformRole: "NONE",
        isAccountOwner: true,
        isActive: true,
        organizationId: organization.id,
        companyName: "Urbano Loft",
        phone: "+57 300 123 4567",
        propertyCount: 4,
        onboardingCompletedAt: new Date(),
        locale: "es",
        timezone: "America/Bogota",
      },
    });
  }

  const propertiesUpdated = await db.property.updateMany({
    where: { organizationId: organization.id },
    data: { ownerId: user.id },
  });

  await clerk.users.updateUser(clerkUser.id, {
    publicMetadata: {
      role: "ADMIN",
      dbUserId: user.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        role: user.role,
        organization: organization.name,
        organizationId: organization.id,
        userId: user.id,
        clerkId: clerkUser.id,
        propertiesReassigned: propertiesUpdated.count,
        seedUsersRemoved: seedUsers.length,
        signIn: "/sign-in",
        note: "Este usuario solo ve datos de la org demo (aislamiento multi-tenant).",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Provision failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
