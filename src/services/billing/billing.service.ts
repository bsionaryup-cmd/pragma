import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  type BillingAccount,
  type BillingInvoice,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  resolveBillingLocked,
  type BillingAccessSnapshot,
} from "@/lib/billing/billing-access";

const SINGLETON_ID = "singleton";
const TRIAL_DAYS = 14;
const GRACE_DAYS = 7;
const MONTHLY_AMOUNT_COP = 199_000;

function isBillingSchemaMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export async function ensureBillingAccount(): Promise<BillingAccount | null> {
  try {
    return await db.billingAccount.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        status: BillingSubscriptionStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
  } catch (error) {
    if (isBillingSchemaMissing(error)) return null;
    throw error;
  }
}

export async function getBillingAccountSafe(): Promise<BillingAccount | null> {
  try {
    return await db.billingAccount.findUnique({ where: { id: SINGLETON_ID } });
  } catch (error) {
    if (isBillingSchemaMissing(error)) return null;
    throw error;
  }
}

export async function listBillingInvoices(limit = 20): Promise<BillingInvoice[]> {
  try {
    return await db.billingInvoice.findMany({
      where: { billingAccountId: SINGLETON_ID },
      orderBy: { dueAt: "desc" },
      take: limit,
    });
  } catch (error) {
    if (isBillingSchemaMissing(error)) return [];
    throw error;
  }
}

export type BillingOverviewDto = {
  ready: boolean;
  access: BillingAccessSnapshot;
  account: {
    status: BillingSubscriptionStatus;
    plan: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    nextRenewalLabel: string | null;
  };
  invoices: Array<{
    id: string;
    amount: string;
    currency: string;
    status: BillingInvoiceStatus;
    description: string | null;
    dueAt: string;
    paidAt: string | null;
  }>;
  paymentMethods: {
    wompiEnabled: boolean;
    pse: boolean;
    nequi: boolean;
    cards: boolean;
    hasDefaultToken: boolean;
  };
};

async function reconcileBillingLifecycle(
  account: BillingAccount,
): Promise<BillingAccount> {
  const now = Date.now();

  if (
    account.status === BillingSubscriptionStatus.TRIAL &&
    account.trialEndsAt &&
    account.trialEndsAt.getTime() < now
  ) {
    const graceEnds = new Date(now + GRACE_DAYS * 24 * 60 * 60 * 1000);
    const updated = await db.billingAccount.update({
      where: { id: SINGLETON_ID },
      data: {
        status: BillingSubscriptionStatus.PAST_DUE,
        gracePeriodEndsAt: graceEnds,
        billingLockedAt: null,
      },
    });

    const openCount = await db.billingInvoice.count({
      where: {
        billingAccountId: SINGLETON_ID,
        status: BillingInvoiceStatus.OPEN,
      },
    });
    if (openCount === 0) {
      await db.billingInvoice.create({
        data: {
          billingAccountId: SINGLETON_ID,
          amount: MONTHLY_AMOUNT_COP,
          currency: "COP",
          status: BillingInvoiceStatus.OPEN,
          description: "Suscripción PRAGMA — período mensual",
          dueAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
          externalRef: `inv-trial-${Date.now()}`,
        },
      });
    }
    return updated;
  }

  if (account.status === BillingSubscriptionStatus.PAST_DUE) {
    const graceExpired =
      account.gracePeriodEndsAt &&
      account.gracePeriodEndsAt.getTime() < now;
    if (graceExpired) {
      return db.billingAccount.update({
        where: { id: SINGLETON_ID },
        data: {
          status: BillingSubscriptionStatus.LOCKED,
          billingLockedAt: new Date(),
        },
      });
    }
  }

  return account;
}

export async function activateBillingSubscription(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    await ensureBillingAccount();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.billingAccount.update({
      where: { id: SINGLETON_ID },
      data: {
        status: BillingSubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        billingLockedAt: null,
        currentPeriodEnd: periodEnd,
      },
    });

    await db.billingInvoice.updateMany({
      where: {
        billingAccountId: SINGLETON_ID,
        status: BillingInvoiceStatus.OPEN,
      },
      data: {
        status: BillingInvoiceStatus.PAID,
        paidAt: new Date(),
      },
    });

    return { ok: true, message: "Suscripción activada" };
  } catch (error) {
    if (isBillingSchemaMissing(error)) {
      return { ok: false, message: "Facturación no disponible (migración pendiente)" };
    }
    throw error;
  }
}

export async function getBillingOverview(): Promise<BillingOverviewDto> {
  let account = (await getBillingAccountSafe()) ?? (await ensureBillingAccount());
  const wompiPublicKey = process.env.WOMPI_PUBLIC_KEY?.trim();

  if (!account) {
    return {
      ready: false,
      access: {
        locked: false,
        status: BillingSubscriptionStatus.TRIAL,
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        reason: "Migración de facturación pendiente",
      },
      account: {
        status: BillingSubscriptionStatus.TRIAL,
        plan: "STARTER",
        trialEndsAt: null,
        currentPeriodEnd: null,
        nextRenewalLabel: null,
      },
      invoices: [],
      paymentMethods: {
        wompiEnabled: Boolean(wompiPublicKey),
        pse: true,
        nequi: true,
        cards: true,
        hasDefaultToken: false,
      },
    };
  }

  account = await reconcileBillingLifecycle(account);

  const locked = resolveBillingLocked({
    status: account.status,
    gracePeriodEndsAt: account.gracePeriodEndsAt,
    billingLockedAt: account.billingLockedAt,
  });

  const invoices = await listBillingInvoices();

  return {
    ready: true,
    access: {
      locked,
      status: account.status,
      trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
      gracePeriodEndsAt: account.gracePeriodEndsAt?.toISOString() ?? null,
      reason: locked
        ? "Suscripción vencida o pago pendiente. Actualiza tu método de pago para continuar."
        : null,
    },
    account: {
      status: account.status,
      plan: account.plan,
      trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: account.currentPeriodEnd?.toISOString() ?? null,
      nextRenewalLabel: account.currentPeriodEnd
        ? account.currentPeriodEnd.toLocaleDateString("es-CO", {
            dateStyle: "medium",
          })
        : null,
    },
    invoices: invoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount.toString(),
      currency: inv.currency,
      status: inv.status,
      description: inv.description,
      dueAt: inv.dueAt.toISOString(),
      paidAt: inv.paidAt?.toISOString() ?? null,
    })),
    paymentMethods: {
      wompiEnabled: Boolean(wompiPublicKey),
      pse: true,
      nequi: true,
      cards: true,
      hasDefaultToken: Boolean(account.defaultPaymentTokenRef),
    },
  };
}

/** Lectura ligera para banner/layout — sin reconciliar ciclo de facturación en cada request. */
export async function getBillingAccessSnapshot(): Promise<BillingAccessSnapshot> {
  try {
    const account = await getBillingAccountSafe();
    if (!account) {
      return {
        locked: false,
        status: BillingSubscriptionStatus.TRIAL,
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        reason: null,
      };
    }

    const locked = resolveBillingLocked({
      status: account.status,
      gracePeriodEndsAt: account.gracePeriodEndsAt,
      billingLockedAt: account.billingLockedAt,
    });

    return {
      locked,
      status: account.status,
      trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
      gracePeriodEndsAt: account.gracePeriodEndsAt?.toISOString() ?? null,
      reason: locked
        ? "Suscripción vencida o pago pendiente. Actualiza tu método de pago para continuar."
        : null,
    };
  } catch (error) {
    if (isBillingSchemaMissing(error)) {
      return {
        locked: false,
        status: BillingSubscriptionStatus.TRIAL,
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        reason: null,
      };
    }
    throw error;
  }
}
