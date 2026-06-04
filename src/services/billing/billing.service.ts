import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  type BillingAccount,
  type BillingInvoice,
} from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import {
  resolveBillingLockReason,
  resolveBillingLocked,
  type BillingAccessSnapshot,
} from "@/lib/billing/billing-access";
import {
  getCurrentBillingAccountId,
  requireBillingAccountId,
  resolveBillingAccountForUserId,
} from "@/lib/billing/resolve-billing-account";
import {
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_TRIAL_DAYS,
} from "@/modules/billing/domain/subscription-pricing";
import { calculateSubscriptionAmount, getPlanPricePerProperty } from "@/modules/billing/domain/plan-catalog";
import {
  resolveSubscriptionAmountForAccount,
  syncOpenInvoiceAmountForAccount,
} from "@/modules/billing/domain/subscription-property-count";
import { resolvePlatformWompiConfig } from "@/modules/billing/services/wompi-credentials";
import {
  isSubscriptionPaymentAvailable,
  resolveSubscriptionPaymentGateway,
} from "@/modules/billing/services/subscription-payment-gateway.service";
import { isPlatformEpaycoConfigured } from "@/modules/integrations/epayco/epayco-credentials";
import {
  reconcileBillingLifecycle,
  accountNeedsLifecycleReconciliation,
  ensureOpenSubscriptionInvoice,
} from "@/modules/billing/services/billing-lifecycle.service";
import { ensureOrganizationBillingAccount } from "@/services/organizations/organization.service";
import { requireDbUser } from "@/lib/auth";

function isBillingSchemaMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export async function ensureBillingAccount(
  organizationId?: string | null,
): Promise<BillingAccount | null> {
  try {
    if (organizationId) {
      return ensureOrganizationBillingAccount(organizationId);
    }

    const user = await requireDbUser();
    if (user.organizationId) {
      return ensureOrganizationBillingAccount(user.organizationId);
    }

    const billingAccountId = await requireBillingAccountId();
    return db.billingAccount.findUnique({ where: { id: billingAccountId } });
  } catch (error) {
    if (isBillingSchemaMissing(error)) return null;
    throw error;
  }
}

export const getBillingAccountSafe = cache(async (): Promise<BillingAccount | null> => {
  try {
    const billingAccountId = await getCurrentBillingAccountId();
    if (!billingAccountId) return null;
    return await db.billingAccount.findUnique({ where: { id: billingAccountId } });
  } catch (error) {
    if (isBillingSchemaMissing(error)) return null;
    throw error;
  }
});

export async function listBillingInvoices(limit = 20): Promise<BillingInvoice[]> {
  try {
    const billingAccountId = await getCurrentBillingAccountId();
    if (!billingAccountId) return [];
    return await db.billingInvoice.findMany({
      where: { billingAccountId },
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
    monthlyAmount: number;
    monthlyCurrency: string;
    propertyCount: number;
    pricePerProperty: number;
  };
  invoices: Array<{
    id: string;
    amount: string;
    currency: string;
    status: BillingInvoiceStatus;
    description: string | null;
    dueAt: string;
    paidAt: string | null;
    manualPaymentRef: string | null;
    manualSubmittedAt: string | null;
  }>;
  paymentMethods: {
    wompiEnabled: boolean;
    epaycoEnabled: boolean;
    onlinePaymentsEnabled: boolean;
    subscriptionGateway: "WOMPI" | "EPAYCO" | null;
    wompiWebhookReady: boolean;
    pse: boolean;
    nequi: boolean;
    cards: boolean;
    hasDefaultToken: boolean;
  };
};

export async function activateBillingSubscription(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const billingAccountId = await requireBillingAccountId();
    await ensureBillingAccount();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.billingAccount.update({
      where: { id: billingAccountId },
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
        billingAccountId,
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
  const [wompi, epaycoConfigured, subscriptionGateway, onlinePaymentsEnabled] =
    await Promise.all([
      resolvePlatformWompiConfig(),
      isPlatformEpaycoConfigured(),
      resolveSubscriptionPaymentGateway(),
      isSubscriptionPaymentAvailable(),
    ]);

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
        monthlyAmount: calculateSubscriptionAmount("STARTER", 1),
        monthlyCurrency: SUBSCRIPTION_CURRENCY,
        propertyCount: 1,
        pricePerProperty: getPlanPricePerProperty("STARTER"),
      },
      invoices: [],
      paymentMethods: {
        wompiEnabled: wompi.configured,
        epaycoEnabled: epaycoConfigured,
        onlinePaymentsEnabled,
        subscriptionGateway,
        wompiWebhookReady: Boolean(wompi.eventsSecret),
        pse: true,
        nequi: true,
        cards: true,
        hasDefaultToken: false,
      },
    };
  }

  account = await reconcileBillingLifecycle(account);
  await syncOpenInvoiceAmountForAccount(account.id);

  if (account.status !== BillingSubscriptionStatus.ACTIVE) {
    await ensureOpenSubscriptionInvoice(
      account.id,
      "Suscripción PRAGMA — activación",
    );
    await syncOpenInvoiceAmountForAccount(account.id);
  }

  const subscriptionPricing = await resolveSubscriptionAmountForAccount({
    plan: account.plan,
    organizationId: account.organizationId,
    metadata: account.metadata,
  });

  const locked = resolveBillingLocked({
    status: account.status,
    trialEndsAt: account.trialEndsAt,
    gracePeriodEndsAt: account.gracePeriodEndsAt,
    billingLockedAt: account.billingLockedAt,
  });
  const lockReason = resolveBillingLockReason({
    locked,
    status: account.status,
    trialEndsAt: account.trialEndsAt,
  });

  const invoices = await listBillingInvoices();

  return {
    ready: true,
    access: {
      locked,
      status: account.status,
      trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
      gracePeriodEndsAt: account.gracePeriodEndsAt?.toISOString() ?? null,
      reason: lockReason,
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
      monthlyAmount: subscriptionPricing.amount,
      monthlyCurrency: SUBSCRIPTION_CURRENCY,
      propertyCount: subscriptionPricing.propertyCount,
      pricePerProperty: getPlanPricePerProperty(account.plan),
    },
    invoices: invoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount.toString(),
      currency: inv.currency,
      status: inv.status,
      description: inv.description,
      dueAt: inv.dueAt.toISOString(),
      paidAt: inv.paidAt?.toISOString() ?? null,
      manualPaymentRef: inv.manualPaymentRef ?? null,
      manualSubmittedAt: inv.manualSubmittedAt?.toISOString() ?? null,
    })),
    paymentMethods: {
      wompiEnabled: wompi.configured,
      epaycoEnabled: epaycoConfigured,
      onlinePaymentsEnabled,
      subscriptionGateway,
      wompiWebhookReady: Boolean(wompi.eventsSecret),
      pse: true,
      nequi: true,
      cards: true,
      hasDefaultToken: Boolean(account.defaultPaymentTokenRef),
    },
  };
}

/** Lectura ligera para banner/layout — reconcilia solo si el ciclo requiere transición. */
export const getBillingAccessSnapshot = cache(
  async (): Promise<BillingAccessSnapshot> => {
    try {
      let account = await getBillingAccountSafe();
      if (!account) {
        return {
          locked: false,
          status: BillingSubscriptionStatus.TRIAL,
          trialEndsAt: null,
          gracePeriodEndsAt: null,
          reason: null,
        };
      }

      if (accountNeedsLifecycleReconciliation(account)) {
        account = await reconcileBillingLifecycle(account);
      }

      const locked = resolveBillingLocked({
        status: account.status,
        trialEndsAt: account.trialEndsAt,
        gracePeriodEndsAt: account.gracePeriodEndsAt,
        billingLockedAt: account.billingLockedAt,
      });
      const lockReason = resolveBillingLockReason({
        locked,
        status: account.status,
        trialEndsAt: account.trialEndsAt,
      });

      return {
        locked,
        status: account.status,
        trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
        gracePeriodEndsAt: account.gracePeriodEndsAt?.toISOString() ?? null,
        reason: lockReason,
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
  },
);

export { SUBSCRIPTION_TRIAL_DAYS, resolveBillingAccountForUserId };
