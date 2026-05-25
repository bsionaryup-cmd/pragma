import { cache } from "react";
import type { BillingPlanCode } from "@prisma/client";
import { db } from "@/lib/db";
import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";
import { parseBillingAccountMetadata } from "@/modules/billing/domain/subscription-property-count";
import {
  getEffectivePropertyLimit,
  getPlanLimits,
} from "@/lib/billing/plan-entitlements";

export type OrganizationPlanContext = {
  organizationId: string;
  plan: BillingPlanCode;
  propertySlots: number | null;
  effectivePropertyLimit: number;
  maxUsers: number;
};

export const getOrganizationPlanContextForUser = cache(
  async (userId: string): Promise<OrganizationPlanContext | null> => {
    const organizationId = await getEffectiveOrganizationIdForUser(userId);
    if (!organizationId) return null;

    const account = await db.billingAccount.findUnique({
      where: { organizationId },
      select: { plan: true, metadata: true },
    });

    const plan = account?.plan ?? "STARTER";
    const { propertySlots } = parseBillingAccountMetadata(account?.metadata);
    const limits = getPlanLimits(plan);

    return {
      organizationId,
      plan,
      propertySlots: propertySlots ?? null,
      effectivePropertyLimit: getEffectivePropertyLimit(plan, propertySlots),
      maxUsers: limits.maxUsers,
    };
  },
);
