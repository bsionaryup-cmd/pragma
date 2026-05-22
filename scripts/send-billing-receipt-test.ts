import { config } from "dotenv";
import {
  BillingInvoiceStatus,
  BillingPlanCode,
  BillingSubscriptionStatus,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { sendEmail } from "@/lib/email/send-email";
import { sendBillingReceiptEmailPreview } from "@/modules/billing/services/billing-receipt-email.service";
import { getPlanMonthlyAmount } from "@/modules/billing/domain/plan-catalog";
import { SUBSCRIPTION_CURRENCY } from "@/modules/billing/domain/subscription-pricing";

config();
config({ path: ".env.local", override: true });

const targetEmail = process.argv[2]?.trim() || "bsionaryup@gmail.com";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function ensureTrialBillingFixture() {
  const plan = BillingPlanCode.STARTER;
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

  const existingPaid = await db.billingInvoice.findFirst({
    where: { status: BillingInvoiceStatus.PAID },
    orderBy: { paidAt: "desc" },
  });

  if (existingPaid) return existingPaid;

  return db.billingInvoice.create({
    data: {
      billingAccountId: "singleton",
      amount: getPlanMonthlyAmount(plan),
      currency: SUBSCRIPTION_CURRENCY,
      status: BillingInvoiceStatus.PAID,
      description: "Suscripción PRAGMA — período de prueba activado",
      dueAt: paidAt,
      paidAt,
      externalRef: `pragma-test-${Date.now()}`,
      wompiTransactionId: `test_tx_${Date.now()}`,
    },
  });
}

async function main() {
  const invoice = await ensureTrialBillingFixture();
  const account = await db.billingAccount.findUnique({ where: { id: "singleton" } });

  if (!account) {
    console.error("No se pudo preparar la cuenta de facturación.");
    process.exit(1);
  }

  const paidAt = invoice.paidAt ?? new Date();
  const periodEnd =
    account.currentPeriodEnd ??
    new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  const admin = await db.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { firstName: true, lastName: true, email: true },
  });

  const preview = sendBillingReceiptEmailPreview({
    invoice,
    plan: account.plan,
    periodStart: paidAt,
    periodEnd,
    paymentMethod: invoice.manualPaymentRef ? "bank_transfer" : "online",
    paymentReference:
      invoice.wompiTransactionId ?? invoice.manualPaymentRef ?? invoice.externalRef,
    recipientName:
      [admin?.firstName, admin?.lastName].filter(Boolean).join(" ").trim() ||
      "Cliente PRAGMA",
  });

  const result = await sendEmail({
    to: targetEmail,
    subject: `[Prueba] ${preview.subject}`,
    html: preview.html,
    text: preview.text,
  });

  console.log(
    JSON.stringify(
      {
        targetEmail,
        invoiceId: invoice.id,
        plan: account.plan,
        amount: String(invoice.amount),
        currency: invoice.currency,
        adminEmail: admin?.email ?? null,
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        result,
      },
      null,
      2,
    ),
  );

  if (!result.ok) process.exit(1);
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
