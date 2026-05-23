/**
 * Removes all tenant accounts from the database, keeping only the platform owner.
 * Preserves schema, migrations, and owner access (SUPER_ADMIN_OWNER).
 *
 * Usage:
 *   node scripts/purge-tenant-accounts.mjs --dry-run
 *   node scripts/purge-tenant-accounts.mjs
 */
import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const dryRun = process.argv.includes("--dry-run");
const PLATFORM_OWNER_EMAIL =
  process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || "bsionaryup@gmail.com";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

async function deletePropertiesForOrganization(orgId) {
  const properties = await db.property.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const propertyIds = properties.map((p) => p.id);
  if (propertyIds.length === 0) return { properties: 0, reservations: 0 };

  const reservations = await db.reservation.findMany({
    where: { propertyId: { in: propertyIds } },
    select: { id: true },
  });
  const reservationIds = reservations.map((r) => r.id);

  if (reservationIds.length > 0) {
    await db.accessEvent.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await db.accessCredential.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await db.guestRegistrationToken.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await db.reservationGuest.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await db.task.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });

    const paymentInvoices = await db.paymentInvoice.findMany({
      where: { reservationId: { in: reservationIds } },
      select: { id: true },
    });
    const paymentInvoiceIds = paymentInvoices.map((p) => p.id);

    if (paymentInvoiceIds.length > 0) {
      await db.paymentRefund.deleteMany({
        where: { invoiceId: { in: paymentInvoiceIds } },
      });
      await db.paymentAttempt.deleteMany({
        where: { invoiceId: { in: paymentInvoiceIds } },
      });
      await db.paymentInvoice.deleteMany({
        where: { id: { in: paymentInvoiceIds } },
      });
    }

    await db.reservation.deleteMany({
      where: { id: { in: reservationIds } },
    });
  }

  await db.task.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await db.propertyLock.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await db.propertyPriceLabs.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await db.property.deleteMany({ where: { id: { in: propertyIds } } });

  return { properties: propertyIds.length, reservations: reservationIds.length };
}

async function deletePropertiesForOwner(ownerId) {
  const properties = await db.property.findMany({
    where: { ownerId },
    select: { id: true },
  });
  if (properties.length === 0) return { properties: 0, reservations: 0 };

  const orgIds = [
    ...new Set(
      (
        await db.property.findMany({
          where: { ownerId },
          select: { organizationId: true },
        })
      )
        .map((p) => p.organizationId)
        .filter(Boolean),
    ),
  ];

  let total = { properties: 0, reservations: 0 };
  for (const orgId of orgIds) {
    const result = await deletePropertiesForOrganization(orgId);
    total.properties += result.properties;
    total.reservations += result.reservations;
  }

  const remaining = await db.property.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const propertyIds = remaining.map((p) => p.id);
  if (propertyIds.length > 0) {
    const reservations = await db.reservation.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true },
    });
    const reservationIds = reservations.map((r) => r.id);
    if (reservationIds.length > 0) {
      await db.accessEvent.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await db.accessCredential.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await db.guestRegistrationToken.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await db.reservationGuest.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await db.task.deleteMany({
        where: { OR: [{ reservationId: { in: reservationIds } }, { propertyId: { in: propertyIds } }] },
      });
      await db.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    }
    await db.propertyLock.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await db.propertyPriceLabs.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await db.property.deleteMany({ where: { id: { in: propertyIds } } });
    total.properties += propertyIds.length;
    total.reservations += reservationIds?.length ?? 0;
  }

  return total;
}

async function main() {
  const owner = await db.user.findFirst({
    where: { email: PLATFORM_OWNER_EMAIL },
    select: { id: true, email: true, platformRole: true },
  });

  if (!owner) {
    throw new Error(`Platform owner not found: ${PLATFORM_OWNER_EMAIL}`);
  }

  const tenantUsers = await db.user.findMany({
    where: { email: { not: PLATFORM_OWNER_EMAIL } },
    select: {
      id: true,
      email: true,
      clerkId: true,
      organizationId: true,
      deletedAt: true,
    },
  });

  const organizations = await db.organization.findMany({
    select: { id: true, name: true },
  });

  const billingAccounts = await db.billingAccount.findMany({
    select: { id: true, organizationId: true, status: true, plan: true },
  });

  console.log(`Purge tenant accounts ${dryRun ? "(dry run)" : ""}`);
  console.log(`Keeping owner: ${owner.email} (${owner.id})`);
  console.log(`Users to remove: ${tenantUsers.length}`);
  console.log(`Organizations to remove: ${organizations.length}`);
  console.log(`Billing accounts to remove: ${billingAccounts.length}`);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          owner,
          tenantUsers,
          organizations,
          billingAccounts,
        },
        null,
        2,
      ),
    );
    return;
  }

  let propertyStats = { properties: 0, reservations: 0 };
  for (const org of organizations) {
    const result = await deletePropertiesForOrganization(org.id);
    propertyStats.properties += result.properties;
    propertyStats.reservations += result.reservations;
  }

  for (const user of tenantUsers) {
    const result = await deletePropertiesForOwner(user.id);
    propertyStats.properties += result.properties;
    propertyStats.reservations += result.reservations;
  }

  await db.organization.deleteMany({});

  const orphanBillingAccounts = await db.billingAccount.findMany({
    select: { id: true },
  });
  if (orphanBillingAccounts.length > 0) {
    await db.billingAccount.deleteMany({
      where: { id: { in: orphanBillingAccounts.map((a) => a.id) } },
    });
  }

  const clerkRemoved = [];
  const clerkErrors = [];
  if (clerk) {
    for (const user of tenantUsers) {
      if (!user.clerkId) continue;
      try {
        await clerk.users.deleteUser(user.clerkId);
        clerkRemoved.push(user.email);
      } catch (error) {
        clerkErrors.push({
          email: user.email,
          clerkId: user.clerkId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const clerkUsers = await clerk.users.getUserList({ limit: 500 });
    for (const clerkUser of clerkUsers.data) {
      const email = clerkUser.emailAddresses[0]?.emailAddress?.trim().toLowerCase();
      if (!email || email === PLATFORM_OWNER_EMAIL) continue;
      try {
        await clerk.users.deleteUser(clerkUser.id);
        clerkRemoved.push(email);
      } catch (error) {
        clerkErrors.push({
          email,
          clerkId: clerkUser.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const deletedUsers = await db.user.deleteMany({
    where: { email: { not: PLATFORM_OWNER_EMAIL } },
  });

  await db.user.update({
    where: { id: owner.id },
    data: {
      organizationId: null,
      isAccountOwner: false,
      isActive: true,
      deletedAt: null,
    },
  });

  const remaining = {
    users: await db.user.count(),
    organizations: await db.organization.count(),
    properties: await db.property.count(),
    reservations: await db.reservation.count(),
    billingAccounts: await db.billingAccount.count(),
  };

  console.log(
    JSON.stringify(
      {
        removed: {
          users: deletedUsers.count,
          organizations: organizations.length,
          billingAccounts: billingAccounts.length,
          clerkUsers: clerkRemoved.length,
          clerkErrors,
          ...propertyStats,
        },
        owner: await db.user.findUnique({
          where: { id: owner.id },
          select: {
            email: true,
            organizationId: true,
            platformRole: true,
            isAccountOwner: true,
          },
        }),
        remaining,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Purge failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
