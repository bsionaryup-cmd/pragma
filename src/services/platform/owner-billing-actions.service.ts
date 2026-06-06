import "server-only";

import {
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
  type BillingPlanCode,
  type TrialRetrialPolicy,
  type User,
} from "@prisma/client";
import { db } from "@/lib/db";
import { buildTrialBillingMetadata } from "@/lib/billing/trial-eligibility-metadata";
import { assertSuperAdminOwner } from "@/lib/platform/platform-owner";
import { ensureOrganizationBillingAccount } from "@/services/organizations/organization.service";
import { mergeSalesBillingMetadata } from "@/modules/sales/domain/sales-billing-metadata";
import { syncOpenInvoiceAmountForAccount } from "@/modules/billing/domain/subscription-property-count";
import { SUBSCRIPTION_TRIAL_DAYS } from "@/modules/billing/domain/subscription-pricing";
import { ensureOpenSubscriptionInvoice } from "@/modules/billing/services/billing-lifecycle.service";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";
import { cancelOrganizationSubscription } from "@/modules/billing/services/subscription-cancel.service";

export async function setTenantPropertySlotsByOwner(input: {
  platformUser: User;
  organizationId: string;
  propertySlots: number;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const propertySlots = Math.max(1, Math.min(9999, Math.round(input.propertySlots)));
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  const before = account.metadata;

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      metadata: mergeSalesBillingMetadata(account.metadata, { propertySlots }),
    },
  });
  await syncOpenInvoiceAmountForAccount(account.id);

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_limits_change",
    targetTenantId: input.organizationId,
    previousState: { metadata: before },
    newState: { propertySlots },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function setTenantTrialRemainingDaysByOwner(input: {
  platformUser: User;
  organizationId: string;
  daysRemaining: number;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const daysRemaining = Math.max(0, Math.min(365, Math.round(input.daysRemaining)));
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  const before = account.trialEndsAt;

  const next =
    daysRemaining === 0
      ? new Date()
      : new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      status: BillingSubscriptionStatus.TRIAL,
      trialEndsAt: next,
      gracePeriodEndsAt: null,
      billingLockedAt: null,
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_trial_set_remaining",
    targetTenantId: input.organizationId,
    previousState: { trialEndsAt: before?.toISOString() ?? null },
    newState: { trialEndsAt: next.toISOString(), daysRemaining },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function extendTenantTrialByOwner(input: {
  platformUser: User;
  organizationId: string;
  days: number;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const days = Math.max(1, Math.min(365, Math.round(input.days)));
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  const before = account.trialEndsAt;

  const base = account.trialEndsAt ?? new Date();
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      status: BillingSubscriptionStatus.TRIAL,
      trialEndsAt: next,
      gracePeriodEndsAt: null,
      billingLockedAt: null,
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_trial_extend",
    targetTenantId: input.organizationId,
    previousState: { trialEndsAt: before?.toISOString() ?? null },
    newState: { trialEndsAt: next.toISOString(), days },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function blockTenantTrialByOwner(input: {
  platformUser: User;
  organizationId: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const account = await ensureOrganizationBillingAccount(input.organizationId);

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      status: BillingSubscriptionStatus.LOCKED,
      trialRetrialPolicy: "BLOCK",
      trialEndsAt: new Date(),
      gracePeriodEndsAt: null,
      billingLockedAt: new Date(),
      currentPeriodEnd: null,
    },
  });

  await db.billingInvoice.updateMany({
    where: {
      billingAccountId: account.id,
      status: { in: [BillingInvoiceStatus.OPEN, BillingInvoiceStatus.DRAFT] },
    },
    data: { status: BillingInvoiceStatus.VOID },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_trial_block",
    targetTenantId: input.organizationId,
    previousState: { status: account.status, trialEndsAt: account.trialEndsAt?.toISOString() ?? null },
    newState: {
      status: BillingSubscriptionStatus.LOCKED,
      trialRetrialPolicy: "BLOCK",
    },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function activateTenantSubscriptionByOwner(input: {
  platformUser: User;
  organizationId: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.$transaction([
    db.billingAccount.update({
      where: { id: account.id },
      data: {
        status: BillingSubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        billingLockedAt: null,
        currentPeriodEnd: periodEnd,
      },
    }),
    db.billingInvoice.updateMany({
      where: {
        billingAccountId: account.id,
        status: BillingInvoiceStatus.OPEN,
      },
      data: {
        status: BillingInvoiceStatus.PAID,
        paidAt: new Date(),
        failureReason: null,
      },
    }),
  ]);

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_activate",
    targetTenantId: input.organizationId,
    previousState: { status: account.status },
    newState: { status: BillingSubscriptionStatus.ACTIVE, currentPeriodEnd: periodEnd.toISOString() },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function pauseTenantSubscriptionByOwner(input: {
  platformUser: User;
  organizationId: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const account = await ensureOrganizationBillingAccount(input.organizationId);

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      status: BillingSubscriptionStatus.LOCKED,
      billingLockedAt: new Date(),
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_pause",
    targetTenantId: input.organizationId,
    previousState: { status: account.status },
    newState: { status: BillingSubscriptionStatus.LOCKED },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function reactivateTenantSubscriptionByOwner(input: {
  platformUser: User;
  organizationId: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  const nextStatus =
    account.currentPeriodEnd && account.currentPeriodEnd.getTime() > Date.now()
      ? BillingSubscriptionStatus.ACTIVE
      : BillingSubscriptionStatus.TRIAL;

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      status: nextStatus,
      billingLockedAt: null,
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_reactivate",
    targetTenantId: input.organizationId,
    previousState: { status: account.status },
    newState: { status: nextStatus },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function cancelTenantSubscriptionByOwner(input: {
  platformUser: User;
  organizationId: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  await cancelOrganizationSubscription({
    billingAccountId: account.id,
    actorId: input.platformUser.id,
    reason: input.reason ?? "owner_ops",
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_cancel",
    targetTenantId: input.organizationId,
    previousState: { status: account.status },
    newState: { status: BillingSubscriptionStatus.CANCELED },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function setTenantTrialRetrialPolicyByOwner(input: {
  platformUser: User;
  organizationId: string;
  policy: TrialRetrialPolicy;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  const owner = await db.user.findFirst({
    where: { organizationId: input.organizationId, isAccountOwner: true, deletedAt: null },
    select: { email: true },
  });

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      trialRetrialPolicy: input.policy,
      ...(owner?.email ? { metadata: buildTrialBillingMetadata(owner.email) } : {}),
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_trial_retrial_policy",
    targetTenantId: input.organizationId,
    previousState: { trialRetrialPolicy: account.trialRetrialPolicy },
    newState: { trialRetrialPolicy: input.policy, trialOwnerEmail: owner?.email ?? null },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function resetTenantTrialByOwner(input: {
  platformUser: User;
  organizationId: string;
  days?: number;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const days = Math.max(1, Math.min(60, Math.round(input.days ?? SUBSCRIPTION_TRIAL_DAYS)));
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      status: BillingSubscriptionStatus.TRIAL,
      trialEndsAt,
      currentPeriodEnd: null,
      gracePeriodEndsAt: null,
      billingLockedAt: null,
    },
  });

  await db.billingInvoice.updateMany({
    where: {
      billingAccountId: account.id,
      status: { in: [BillingInvoiceStatus.OPEN, BillingInvoiceStatus.DRAFT] },
    },
    data: { status: BillingInvoiceStatus.VOID },
  });

  await ensureOpenSubscriptionInvoice(
    account.id,
    "Suscripción PRAGMA — prueba reiniciada por owner",
  );
  await syncOpenInvoiceAmountForAccount(account.id);

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "billing_trial_reset",
    targetTenantId: input.organizationId,
    previousState: {
      status: account.status,
      trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
    },
    newState: {
      status: BillingSubscriptionStatus.TRIAL,
      trialEndsAt: trialEndsAt.toISOString(),
      days,
    },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function setTenantPlanByOwner(input: {
  platformUser: User;
  organizationId: string;
  plan: BillingPlanCode;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const account = await ensureOrganizationBillingAccount(input.organizationId);
  if (account.plan === input.plan) return;
  const prev = account.plan;
  await db.billingAccount.update({
    where: { id: account.id },
    data: { plan: input.plan },
  });
  await syncOpenInvoiceAmountForAccount(account.id);

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "plan_change",
    targetTenantId: input.organizationId,
    previousState: { plan: prev },
    newState: { plan: input.plan },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

