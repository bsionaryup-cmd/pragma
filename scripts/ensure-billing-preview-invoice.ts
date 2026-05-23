/**
 * DEV ONLY — Garantiza una factura PAID de muestra para probar descarga PDF en /settings/billing.
 * No ejecutar en producción. Prefer purge: node scripts/purge-demo-artifacts.mjs
 * Uso: npx tsx scripts/ensure-billing-preview-invoice.ts
 */
import { config } from "dotenv";
import {
  BillingInvoiceStatus,
  BillingPlanCode,
  BillingSubscriptionStatus,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { getPlanMonthlyAmount } from "@/modules/billing/domain/plan-catalog";
import { SUBSCRIPTION_CURRENCY } from "@/modules/billing/domain/subscription-pricing";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const account = await db.billingAccount.findUnique({ where: { id: "singleton" } });
  const plan = account?.plan ?? BillingPlanCode.STARTER;
  const paidAt = new Date();
  const periodEnd = new Date(paidAt);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.billingAccount.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      status: BillingSubscriptionStatus.ACTIVE,
      plan,
      currentPeriodEnd: periodEnd,
    },
    update: {
      status: BillingSubscriptionStatus.ACTIVE,
      plan,
      currentPeriodEnd: periodEnd,
    },
  });

  const existing = await db.billingInvoice.findFirst({
    where: { status: BillingInvoiceStatus.PAID },
    orderBy: { paidAt: "desc" },
  });

  if (existing) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          message: "Ya existe factura pagada",
          invoiceId: existing.id,
          amount: String(existing.amount),
          plan,
        },
        null,
        2,
      ),
    );
    return;
  }

  const invoice = await db.billingInvoice.create({
    data: {
      billingAccountId: "singleton",
      amount: getPlanMonthlyAmount(plan),
      currency: SUBSCRIPTION_CURRENCY,
      status: BillingInvoiceStatus.PAID,
      description: `Suscripción PRAGMA ${plan} — período mensual`,
      dueAt: paidAt,
      paidAt,
      externalRef: `pragma-preview-${Date.now()}`,
      wompiTransactionId: `preview_tx_${Date.now()}`,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "Factura de muestra creada",
        invoiceId: invoice.id,
        amount: String(invoice.amount),
        plan,
        downloadPath: `/api/billing/invoices/${invoice.id}/pdf`,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
