import { BillingSubscriptionStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertEmailEligibleForNewSaasTrial } from "@/lib/billing/trial-eligibility";
import { buildTrialBillingMetadata } from "@/lib/billing/trial-eligibility-metadata";
import { SUBSCRIPTION_TRIAL_DAYS } from "@/modules/billing/domain/subscription-pricing";

function deriveOrganizationName(email: string, firstName?: string | null): string {
  const trimmedName = firstName?.trim();
  if (trimmedName) return trimmedName;

  const localPart = email.split("@")[0]?.trim();
  if (localPart && localPart.length >= 2) {
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }

  return "Mi negocio";
}

type OrganizationTrialInput = {
  name?: string;
  email?: string;
  firstName?: string | null;
};

export async function createOrganizationWithTrialInTransaction(
  tx: Prisma.TransactionClient,
  input: OrganizationTrialInput,
) {
  const name =
    input.name?.trim() ||
    (input.email ? deriveOrganizationName(input.email, input.firstName) : "Mi negocio");

  const trialEndsAt = new Date(
    Date.now() + SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000,
  );

  if (input.email) {
    await assertEmailEligibleForNewSaasTrial(input.email);
  }

  const organization = await tx.organization.create({
    data: { name },
  });

  await tx.billingAccount.create({
    data: {
      organizationId: organization.id,
      status: BillingSubscriptionStatus.TRIAL,
      trialEndsAt,
      metadata: input.email ? buildTrialBillingMetadata(input.email) : undefined,
    },
  });

  return organization;
}

export async function createOrganizationWithTrial(input: OrganizationTrialInput) {
  return db.$transaction(async (tx) => createOrganizationWithTrialInTransaction(tx, input));
}

export async function ensureOrganizationBillingAccount(
  organizationId: string,
  options?: { ownerEmail?: string | null },
) {
  const existing = await db.billingAccount.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;

  const ownerEmail = options?.ownerEmail?.trim();
  if (ownerEmail) {
    await assertEmailEligibleForNewSaasTrial(ownerEmail);
  }

  const trialEndsAt = new Date(
    Date.now() + SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000,
  );

  return db.billingAccount.create({
    data: {
      organizationId,
      status: BillingSubscriptionStatus.TRIAL,
      trialEndsAt,
      metadata: ownerEmail ? buildTrialBillingMetadata(ownerEmail) : undefined,
    },
  });
}
