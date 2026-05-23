import { db } from "@/lib/db";
import {
  calculateSubscriptionAmount,
  clampPropertyCount,
} from "@/modules/billing/domain/plan-catalog";
import type { BillingPlanCode } from "@prisma/client";

export type BillingAccountMetadata = {
  propertySlots?: number;
};

export function parseBillingAccountMetadata(
  metadata: unknown,
): BillingAccountMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const raw = metadata as Record<string, unknown>;
  const propertySlots =
    typeof raw.propertySlots === "number" ? raw.propertySlots : undefined;
  return {
    propertySlots:
      propertySlots !== undefined ? clampPropertyCount(propertySlots) : undefined,
  };
}

export function resolveBillablePropertyCount(input: {
  propertySlots?: number | null;
  activePropertyCount: number;
  userPropertyCount?: number | null;
}): number {
  const candidates = [
    input.propertySlots,
    input.userPropertyCount,
    input.activePropertyCount,
    1,
  ].filter((value): value is number => typeof value === "number" && value >= 1);

  return clampPropertyCount(Math.max(...candidates));
}

export async function getActivePropertyCountForOrganization(
  organizationId: string,
): Promise<number> {
  return db.property.count({
    where: { organizationId, status: "ACTIVE" },
  });
}

export async function resolveSubscriptionPropertyCountForAccount(input: {
  organizationId?: string | null;
  metadata: unknown;
  userPropertyCount?: number | null;
}): Promise<number> {
  const { propertySlots } = parseBillingAccountMetadata(input.metadata);
  const activePropertyCount = input.organizationId
    ? await getActivePropertyCountForOrganization(input.organizationId)
    : 0;

  return resolveBillablePropertyCount({
    propertySlots,
    activePropertyCount,
    userPropertyCount: input.userPropertyCount,
  });
}

export async function resolveSubscriptionAmountForAccount(input: {
  plan: BillingPlanCode;
  organizationId?: string | null;
  metadata: unknown;
  userPropertyCount?: number | null;
}): Promise<{ propertyCount: number; amount: number }> {
  let userPropertyCount = input.userPropertyCount;
  if (userPropertyCount == null && input.organizationId) {
    const owner = await db.user.findFirst({
      where: {
        organizationId: input.organizationId,
        isAccountOwner: true,
        deletedAt: null,
      },
      select: { propertyCount: true },
    });
    userPropertyCount = owner?.propertyCount ?? null;
  }

  const propertyCount = await resolveSubscriptionPropertyCountForAccount({
    organizationId: input.organizationId,
    metadata: input.metadata,
    userPropertyCount,
  });
  return {
    propertyCount,
    amount: calculateSubscriptionAmount(input.plan, propertyCount),
  };
}

export async function syncOpenInvoiceAmountForAccount(
  billingAccountId: string,
): Promise<void> {
  const account = await db.billingAccount.findUnique({
    where: { id: billingAccountId },
    include: {
      organization: {
        select: {
          users: {
            where: { isAccountOwner: true, deletedAt: null },
            take: 1,
            select: { propertyCount: true },
          },
        },
      },
    },
  });

  if (!account) return;

  const { amount } = await resolveSubscriptionAmountForAccount({
    plan: account.plan,
    organizationId: account.organizationId,
    metadata: account.metadata,
    userPropertyCount: account.organization?.users[0]?.propertyCount ?? null,
  });

  await db.billingInvoice.updateMany({
    where: { billingAccountId, status: "OPEN" },
    data: { amount },
  });
}
