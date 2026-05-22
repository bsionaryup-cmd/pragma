import { BillingSubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
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

export async function createOrganizationWithTrial(input: {
  name?: string;
  email?: string;
  firstName?: string | null;
}) {
  const name =
    input.name?.trim() ||
    (input.email ? deriveOrganizationName(input.email, input.firstName) : "Mi negocio");

  const trialEndsAt = new Date(
    Date.now() + SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000,
  );

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name },
    });

    await tx.billingAccount.create({
      data: {
        organizationId: organization.id,
        status: BillingSubscriptionStatus.TRIAL,
        trialEndsAt,
      },
    });

    return organization;
  });
}

export async function ensureOrganizationBillingAccount(organizationId: string) {
  const existing = await db.billingAccount.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;

  const trialEndsAt = new Date(
    Date.now() + SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000,
  );

  return db.billingAccount.create({
    data: {
      organizationId,
      status: BillingSubscriptionStatus.TRIAL,
      trialEndsAt,
    },
  });
}
