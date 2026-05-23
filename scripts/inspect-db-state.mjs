/**
 * Inventory DB records for purge planning.
 * Usage: node scripts/inspect-db-state.mjs
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const [
    orgs,
    users,
    properties,
    billingAccounts,
    reservations,
    invoices,
  ] = await Promise.all([
    db.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
        billingAccount: { select: { id: true, status: true, plan: true } },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            email: true,
            role: true,
            isAccountOwner: true,
            platformRole: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.user.count(),
    db.property.count(),
    db.billingAccount.findMany({
      select: {
        id: true,
        organizationId: true,
        status: true,
        plan: true,
      },
    }),
    db.reservation.count(),
    db.billingInvoice.findMany({
      select: { id: true, externalRef: true, status: true, billingAccountId: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  console.log(JSON.stringify({ orgs, billingAccounts, totals: { users, properties, reservations }, recentInvoices: invoices }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
