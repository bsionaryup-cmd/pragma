/**
 * Purges development/test data from the database while preserving schema,
 * real tenant accounts, and platform owner access.
 *
 * Usage:
 *   node scripts/purge-test-data.mjs --dry-run
 *   node scripts/purge-test-data.mjs
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const dryRun = process.argv.includes("--dry-run");
const LEGACY_ORG_ID = "org_legacy_default";
const PLATFORM_OWNER_EMAIL =
  process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || "bsionaryup@gmail.com";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

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

async function deleteOrphanOrganizations() {
  const orphans = await db.organization.findMany({
    where: {
      users: { none: { deletedAt: null } },
      properties: { none: {} },
    },
    select: { id: true, name: true },
  });

  if (!dryRun && orphans.length > 0) {
    await db.organization.deleteMany({
      where: { id: { in: orphans.map((o) => o.id) } },
    });
  }

  return orphans;
}

async function purgeLegacyTestInvoices() {
  const invoices = await db.billingInvoice.findMany({
    where: {
      OR: [
        { externalRef: { startsWith: "pragma-preview-" } },
        { externalRef: { startsWith: "pragma-test-" } },
      ],
    },
    select: { id: true, externalRef: true },
  });

  if (!dryRun && invoices.length > 0) {
    await db.billingInvoice.deleteMany({
      where: { id: { in: invoices.map((i) => i.id) } },
    });
  }

  return invoices;
}

async function fixUserTenancy() {
  const updates = [];

  const platformOwner = await db.user.findFirst({
    where: { email: PLATFORM_OWNER_EMAIL },
    select: { id: true, organizationId: true, isAccountOwner: true },
  });

  if (
    platformOwner &&
    (platformOwner.organizationId !== null || platformOwner.isAccountOwner)
  ) {
    updates.push({
      id: platformOwner.id,
      email: PLATFORM_OWNER_EMAIL,
      action: "detach_platform_owner",
    });
    if (!dryRun) {
      await db.user.update({
        where: { id: platformOwner.id },
        data: { organizationId: null, isAccountOwner: false },
      });
    }
  }

  const legacyTestUsers = await db.user.findMany({
    where: {
      organizationId: LEGACY_ORG_ID,
      email: { not: PLATFORM_OWNER_EMAIL },
    },
    select: { id: true, email: true, deletedAt: true },
  });

  for (const user of legacyTestUsers) {
    updates.push({
      id: user.id,
      email: user.email,
      action: user.deletedAt ? "clear_legacy_org" : "soft_delete_test_user",
    });
    if (!dryRun) {
      await db.user.update({
        where: { id: user.id },
        data: {
          organizationId: null,
          isActive: false,
          deletedAt: user.deletedAt ?? new Date(),
          isAccountOwner: false,
        },
      });
    }
  }

  return updates;
}

async function deleteLegacyOrganizationIfEmpty() {
  const legacy = await db.organization.findUnique({
    where: { id: LEGACY_ORG_ID },
    include: {
      _count: { select: { users: true, properties: true } },
    },
  });

  if (!legacy) return null;
  if (legacy._count.users > 0 || legacy._count.properties > 0) {
    return { kept: true, users: legacy._count.users, properties: legacy._count.properties };
  }

  if (!dryRun) {
    await db.organization.delete({ where: { id: LEGACY_ORG_ID } });
  }

  return { deleted: true };
}

async function main() {
  console.log(`PRAGMA test-data purge ${dryRun ? "(dry run)" : ""}`);

  const legacyPurge = await (async () => {
    if (dryRun) {
      const count = await db.property.count({ where: { organizationId: LEGACY_ORG_ID } });
      const reservations = await db.reservation.count({
        where: { property: { organizationId: LEGACY_ORG_ID } },
      });
      return { properties: count, reservations, dryRun: true };
    }
    return deletePropertiesForOrganization(LEGACY_ORG_ID);
  })();

  const orphanOrgs = await deleteOrphanOrganizations();
  const testInvoices = await purgeLegacyTestInvoices();
  const userUpdates = await fixUserTenancy();
  const legacyOrgResult = await deleteLegacyOrganizationIfEmpty();

  const remaining = {
    organizations: await db.organization.count(),
    users: await db.user.count({ where: { deletedAt: null } }),
    properties: await db.property.count(),
    reservations: await db.reservation.count(),
  };

  console.log(
    JSON.stringify(
      {
        legacyPurge,
        orphanOrgsDeleted: orphanOrgs.length,
        orphanOrgSample: orphanOrgs.slice(0, 5),
        testInvoicesRemoved: testInvoices.length,
        userUpdates,
        legacyOrgResult,
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
