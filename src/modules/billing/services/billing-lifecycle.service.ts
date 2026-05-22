import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  type BillingAccount,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_GRACE_DAYS,
} from "@/modules/billing/domain/subscription-pricing";
import { getPlanMonthlyAmount } from "@/modules/billing/domain/plan-catalog";
import { ensurePaymentInvoiceForBillingInvoice } from "@/modules/billing/services/invoice.service";

export async function ensureOpenSubscriptionInvoice(
  billingAccountId: string,
  description = "Suscripción PRAGMA — período mensual",
  dueInDays = 3,
): Promise<void> {
  const openCount = await db.billingInvoice.count({
    where: {
      billingAccountId,
      status: BillingInvoiceStatus.OPEN,
    },
  });

  if (openCount > 0) return;

  const account = await db.billingAccount.findUnique({
    where: { id: billingAccountId },
  });

  const created = await db.billingInvoice.create({
    data: {
      billingAccountId,
      amount: getPlanMonthlyAmount(account?.plan ?? "STARTER"),
      currency: SUBSCRIPTION_CURRENCY,
      status: BillingInvoiceStatus.OPEN,
      description,
      dueAt: new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000),
    },
  });

  void ensurePaymentInvoiceForBillingInvoice(created.id).catch((err) => {
    console.error("[billing] payment invoice sync:", err);
  });
}

export async function reconcileBillingLifecycle(
  account: BillingAccount,
): Promise<BillingAccount> {
  const now = Date.now();
  const billingAccountId = account.id;

  if (
    account.status === BillingSubscriptionStatus.TRIAL &&
    account.trialEndsAt &&
    account.trialEndsAt.getTime() < now
  ) {
    const graceEnds = new Date(now + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const updated = await db.billingAccount.update({
      where: { id: billingAccountId },
      data: {
        status: BillingSubscriptionStatus.PAST_DUE,
        gracePeriodEndsAt: graceEnds,
        billingLockedAt: null,
      },
    });

    await ensureOpenSubscriptionInvoice(
      billingAccountId,
      "Suscripción PRAGMA — fin de período de prueba",
    );
    return updated;
  }

  if (
    account.status === BillingSubscriptionStatus.ACTIVE &&
    account.currentPeriodEnd &&
    account.currentPeriodEnd.getTime() < now
  ) {
    const graceEnds = new Date(now + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const renewalLabel = account.currentPeriodEnd.toLocaleDateString("es-CO", {
      dateStyle: "medium",
    });
    const updated = await db.billingAccount.update({
      where: { id: billingAccountId },
      data: {
        status: BillingSubscriptionStatus.PAST_DUE,
        gracePeriodEndsAt: graceEnds,
        billingLockedAt: null,
      },
    });

    await ensureOpenSubscriptionInvoice(
      billingAccountId,
      `Suscripción PRAGMA — renovación mensual (venció ${renewalLabel})`,
    );
    return updated;
  }

  if (account.status === BillingSubscriptionStatus.PAST_DUE) {
    await ensureOpenSubscriptionInvoice(billingAccountId);

    const graceExpired =
      account.gracePeriodEndsAt && account.gracePeriodEndsAt.getTime() < now;
    if (graceExpired) {
      return db.billingAccount.update({
        where: { id: billingAccountId },
        data: {
          status: BillingSubscriptionStatus.LOCKED,
          billingLockedAt: new Date(),
        },
      });
    }
  }

  return account;
}

export function accountNeedsLifecycleReconciliation(account: BillingAccount): boolean {
  const now = Date.now();

  if (
    account.status === BillingSubscriptionStatus.TRIAL &&
    account.trialEndsAt &&
    account.trialEndsAt.getTime() < now
  ) {
    return true;
  }

  if (
    account.status === BillingSubscriptionStatus.ACTIVE &&
    account.currentPeriodEnd &&
    account.currentPeriodEnd.getTime() < now
  ) {
    return true;
  }

  if (
    account.status === BillingSubscriptionStatus.PAST_DUE &&
    account.gracePeriodEndsAt &&
    account.gracePeriodEndsAt.getTime() < now
  ) {
    return true;
  }

  return false;
}
