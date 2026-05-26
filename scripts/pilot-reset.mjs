/**
 * Controlled pilot reset: removes tenant/test data while preserving platform owner.
 *
 * NEVER touches:
 * - Platform owner user (PLATFORM_OWNER_EMAIL + SUPER_ADMIN_OWNER)
 * - Organization "PRAGMA Platform (Wompi)" (SaaS Wompi config)
 * - Billing account tied to platform org / singleton platform billing
 *
 * Usage:
 *   node scripts/pilot-reset.mjs --dry-run
 *   node scripts/pilot-reset.mjs
 *   node scripts/pilot-reset.mjs --purge-leads   (default: purges leads table)
 *   node scripts/pilot-reset.mjs --skip-clerk    (DB only)
 */
import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const dryRun = process.argv.includes("--dry-run");
const skipClerk = process.argv.includes("--skip-clerk");
const purgeLeads = !process.argv.includes("--keep-leads");

const PLATFORM_OWNER_EMAIL =
  process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || "bsionaryup@gmail.com";
const PROTECTED_ORG_NAMES = ["PRAGMA Platform (Wompi)"];
const PLATFORM_BILLING_ACCOUNT_IDS = new Set(["singleton"]);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

function isProtectedOwner(user) {
  return (
    user.email?.trim().toLowerCase() === PLATFORM_OWNER_EMAIL &&
    user.platformRole === "SUPER_ADMIN_OWNER"
  );
}

function isProtectedBillingAccount(account) {
  if (PLATFORM_BILLING_ACCOUNT_IDS.has(account.id)) return true;
  if (account.organizationId && protectedOrgIdSet.has(account.organizationId)) {
    return true;
  }
  return false;
}

/** @type {Set<string>} */
let protectedOrgIdSet = new Set();

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
      where: {
        OR: [
          { reservationId: { in: reservationIds } },
          { propertyId: { in: propertyIds } },
        ],
      },
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
      await db.paymentTransaction.deleteMany({
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
  await db.guestPaymentLink.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await db.propertyLock.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await db.propertyPriceLabs.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await db.property.deleteMany({ where: { id: { in: propertyIds } } });

  return { properties: propertyIds.length, reservations: reservationIds.length };
}

async function deletePaymentLedgerForTenantOrgIds(tenantOrgIds) {
  if (tenantOrgIds.length === 0) return;

  await db.paymentRefund.deleteMany({
    where: { tenantId: { in: tenantOrgIds } },
  });
  await db.paymentAttempt.deleteMany({
    where: { tenantId: { in: tenantOrgIds } },
  });
  await db.paymentTransaction.deleteMany({
    where: { tenantId: { in: tenantOrgIds } },
  });
  await db.paymentInvoice.deleteMany({
    where: { tenantId: { in: tenantOrgIds } },
  });
  await db.paymentWebhookLog.deleteMany({
    where: { tenantId: { in: tenantOrgIds } },
  });
  await db.paymentAuditLog.deleteMany({
    where: { tenantId: { in: tenantOrgIds } },
  });
}

async function purgeTenantScopedSales(tenantOrgIds) {
  if (tenantOrgIds.length === 0) return { quotes: 0, discountCodes: 0 };

  const quotes = await db.salesQuote.deleteMany({
    where: { organizationId: { in: tenantOrgIds } },
  });

  const discountCodes = await db.salesDiscountCode.deleteMany({
    where: { organizationId: { in: tenantOrgIds } },
  });

  return { quotes: quotes.count, discountCodes: discountCodes.count };
}

async function main() {
  const owner = await db.user.findFirst({
    where: {
      email: PLATFORM_OWNER_EMAIL,
      platformRole: "SUPER_ADMIN_OWNER",
    },
    select: {
      id: true,
      email: true,
      clerkId: true,
      platformRole: true,
      organizationId: true,
      isAccountOwner: true,
    },
  });

  if (!owner) {
    throw new Error(
      `Platform owner not found (${PLATFORM_OWNER_EMAIL} + SUPER_ADMIN_OWNER). Aborting.`,
    );
  }

  const protectedOrgs = await db.organization.findMany({
    where: { name: { in: PROTECTED_ORG_NAMES } },
    select: { id: true, name: true },
  });
  protectedOrgIdSet = new Set(protectedOrgs.map((o) => o.id));

  const allOrgs = await db.organization.findMany({
    select: { id: true, name: true },
  });
  const tenantOrgs = allOrgs.filter((o) => !protectedOrgIdSet.has(o.id));
  const tenantOrgIds = tenantOrgs.map((o) => o.id);

  const allUsers = await db.user.findMany({
    select: {
      id: true,
      email: true,
      clerkId: true,
      organizationId: true,
      platformRole: true,
      role: true,
      isAccountOwner: true,
      deletedAt: true,
    },
  });

  const tenantUsers = allUsers.filter((u) => !isProtectedOwner(u) && u.id !== owner.id);

  const allBilling = await db.billingAccount.findMany({
    select: { id: true, organizationId: true, status: true, plan: true },
  });
  const billingToRemove = allBilling.filter((a) => !isProtectedBillingAccount(a));

  const impersonationCount = await db.platformImpersonationSession.count({
    where: { targetOrganizationId: { in: tenantOrgIds } },
  });

  const leadCount = purgeLeads ? await db.lead.count() : 0;

  const inventory = {
    dryRun,
    owner: { id: owner.id, email: owner.email, clerkId: owner.clerkId },
    protectedOrganizations: protectedOrgs,
    tenantOrganizations: tenantOrgs,
    tenantUsers: tenantUsers.map((u) => ({
      id: u.id,
      email: u.email,
      organizationId: u.organizationId,
      deletedAt: u.deletedAt,
    })),
    billingAccountsToRemove: billingToRemove,
    impersonationSessionsToRemove: impersonationCount,
    leadsToRemove: leadCount,
  };

  console.log(`PRAGMA pilot reset ${dryRun ? "(dry run)" : ""}`);
  console.log(JSON.stringify(inventory, null, 2));

  if (dryRun) {
    return;
  }

  let propertyStats = { properties: 0, reservations: 0 };

  for (const orgId of tenantOrgIds) {
    const result = await deletePropertiesForOrganization(orgId);
    propertyStats.properties += result.properties;
    propertyStats.reservations += result.reservations;
  }

  await deletePaymentLedgerForTenantOrgIds(tenantOrgIds);
  const salesPurge = await purgeTenantScopedSales(tenantOrgIds);

  if (tenantOrgIds.length > 0) {
    await db.platformImpersonationSession.deleteMany({
      where: { targetOrganizationId: { in: tenantOrgIds } },
    });
    await db.organization.deleteMany({
      where: { id: { in: tenantOrgIds } },
    });
  }

  if (billingToRemove.length > 0) {
    await db.billingAccount.deleteMany({
      where: { id: { in: billingToRemove.map((a) => a.id) } },
    });
  }

  const tenantUserIds = tenantUsers.map((u) => u.id);
  if (tenantUserIds.length > 0) {
    await db.loginActivity.deleteMany({
      where: { userId: { in: tenantUserIds } },
    });
    await db.salesQuoteEvent.deleteMany({
      where: { actorId: { in: tenantUserIds } },
    });
  }

  const clerkRemoved = [];
  const clerkErrors = [];
  if (clerk && !skipClerk) {
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
        if (!clerkRemoved.includes(email)) clerkRemoved.push(email);
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
    where: {
      id: { in: tenantUserIds },
    },
  });

  let leadsRemoved = 0;
  if (purgeLeads) {
    const leads = await db.lead.deleteMany();
    leadsRemoved = leads.count;
  }

  await db.user.update({
    where: { id: owner.id },
    data: {
      organizationId: null,
      isAccountOwner: false,
      isActive: true,
      deletedAt: null,
    },
  });

  const ownerAfter = await db.user.findUnique({
    where: { id: owner.id },
    select: {
      id: true,
      email: true,
      platformRole: true,
      organizationId: true,
      isAccountOwner: true,
      isActive: true,
      deletedAt: true,
    },
  });

  const remaining = {
    users: await db.user.count(),
    organizations: await db.organization.count(),
    properties: await db.property.count(),
    reservations: await db.reservation.count(),
    billingAccounts: await db.billingAccount.count(),
    leads: await db.lead.count(),
  };

  const protectedBilling = await db.billingAccount.findMany({
    where: {
      OR: [
        { id: { in: [...PLATFORM_BILLING_ACCOUNT_IDS] } },
        { organizationId: { in: [...protectedOrgIdSet] } },
      ],
    },
    select: { id: true, organizationId: true, status: true },
  });

  console.log(
    JSON.stringify(
      {
        removed: {
          tenantOrganizations: tenantOrgIds.length,
          users: deletedUsers.count,
          billingAccounts: billingToRemove.length,
          clerkUsers: clerkRemoved.length,
          clerkErrors,
          leads: leadsRemoved,
          salesPurge,
          impersonationSessions: impersonationCount,
          ...propertyStats,
        },
        ownerAfter,
        protectedBilling,
        remaining,
      },
      null,
      2,
    ),
  );

  if (ownerAfter?.email !== PLATFORM_OWNER_EMAIL || ownerAfter.platformRole !== "SUPER_ADMIN_OWNER") {
    throw new Error("Owner integrity check FAILED after reset");
  }
}

main()
  .catch((error) => {
    console.error("Pilot reset failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
