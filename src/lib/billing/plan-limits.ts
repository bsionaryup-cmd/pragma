import type { BillingPlanCode } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getCommercialPlanLabel,
  getEffectivePropertyLimit,
  getPlanLimits,
  getRequiredPlanForFeature,
  planHasFeature,
  type PlanFeature,
} from "@/lib/billing/plan-entitlements";
import { PlanLimitError } from "@/lib/billing/plan-limit.errors";
import { getOrganizationPlanContextForUser } from "@/lib/billing/organization-plan";
import { parseBillingAccountMetadata } from "@/modules/billing/domain/subscription-property-count";
import { getActivePropertyCountForOrganization } from "@/modules/billing/domain/subscription-property-count";

export {
  clampPropertyCountForPlan,
  getEffectivePropertyLimit,
  getPlanLimits,
} from "@/lib/billing/plan-entitlements";

export async function assertCanAddPropertyForOrganization(
  organizationId: string,
  options?: {
    plan?: BillingPlanCode;
    propertySlots?: number | null;
  },
): Promise<void> {
  let plan = options?.plan;
  let propertySlots = options?.propertySlots;

  if (!plan) {
    const account = await db.billingAccount.findUnique({
      where: { organizationId },
      select: { plan: true, metadata: true },
    });
    plan = account?.plan ?? "STARTER";
    propertySlots ??= parseBillingAccountMetadata(account?.metadata).propertySlots;
  }

  const limit = getEffectivePropertyLimit(plan, propertySlots);
  const activeCount = await getActivePropertyCountForOrganization(organizationId);

  if (activeCount >= limit) {
    const label = getCommercialPlanLabel(plan);
    const upgrade =
      plan === "STARTER" ? "PRO" : plan === "PRO" ? "SCALE" : undefined;
    throw new PlanLimitError(
      `Tu plan ${label} permite hasta ${limit} propiedad${limit === 1 ? "" : "es"} activas. Actualiza tu suscripción en Mi Suscripción para agregar más.`,
      upgrade,
    );
  }
}

export async function assertCanAddPropertyForUser(
  userId: string,
): Promise<void> {
  const ctx = await getOrganizationPlanContextForUser(userId);
  if (!ctx) return;
  await assertCanAddPropertyForOrganization(ctx.organizationId, {
    plan: ctx.plan,
    propertySlots: ctx.propertySlots,
  });
}

async function countActiveOrganizationUsers(
  organizationId: string,
): Promise<number> {
  return db.user.count({
    where: {
      organizationId,
      deletedAt: null,
      isActive: true,
    },
  });
}

export async function assertCanAddUserForOrganization(
  organizationId: string,
  plan?: BillingPlanCode,
): Promise<void> {
  const resolvedPlan =
    plan ??
    (
      await db.billingAccount.findUnique({
        where: { organizationId },
        select: { plan: true },
      })
    )?.plan ??
    "STARTER";

  const maxUsers = getPlanLimits(resolvedPlan).maxUsers;
  const count = await countActiveOrganizationUsers(organizationId);

  if (count >= maxUsers) {
    const label = getCommercialPlanLabel(resolvedPlan);
    const upgrade =
      resolvedPlan === "STARTER"
        ? "PRO"
        : resolvedPlan === "PRO"
          ? "SCALE"
          : undefined;
    throw new PlanLimitError(
      `Tu plan ${label} permite hasta ${maxUsers} usuario${maxUsers === 1 ? "" : "s"} activos. Mejora tu plan en Mi Suscripción.`,
      upgrade,
    );
  }
}

export async function assertOrganizationHasPlanFeature(
  organizationId: string,
  feature: PlanFeature,
): Promise<void> {
  const account = await db.billingAccount.findUnique({
    where: { organizationId },
    select: { plan: true },
  });
  const plan = account?.plan ?? "STARTER";
  if (planHasFeature(plan, feature)) return;

  const required = getRequiredPlanForFeature(feature);
  throw new PlanLimitError(
    `Esta función requiere el plan ${getCommercialPlanLabel(required)} o superior. Actualiza en Mi Suscripción.`,
    required,
  );
}

export async function assertUserHasPlanFeature(
  userId: string,
  feature: PlanFeature,
): Promise<void> {
  const ctx = await getOrganizationPlanContextForUser(userId);
  if (!ctx) return;
  await assertOrganizationHasPlanFeature(ctx.organizationId, feature);
}
