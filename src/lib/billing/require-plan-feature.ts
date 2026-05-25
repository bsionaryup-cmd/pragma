import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import {
  getCommercialPlanLabel,
  planHasFeature,
  type PlanFeature,
} from "@/lib/billing/plan-entitlements";
import { getOrganizationPlanContextForUser } from "@/lib/billing/organization-plan";

/** Redirige a Mi Suscripción si el tenant no tiene el feature en su plan. */
export async function redirectIfMissingPlanFeature(
  feature: PlanFeature,
  returnPath?: string,
): Promise<void> {
  const user = await requireDbUser();
  const ctx = await getOrganizationPlanContextForUser(user.id);
  if (!ctx) return;
  if (planHasFeature(ctx.plan, feature)) return;

  const params = new URLSearchParams({ upgrade: feature });
  if (returnPath) params.set("from", returnPath);
  redirect(`/settings/billing?${params.toString()}`);
}

export async function getTenantPlanLabelForUser(
  userId: string,
): Promise<string | null> {
  const ctx = await getOrganizationPlanContextForUser(userId);
  if (!ctx) return null;
  return getCommercialPlanLabel(ctx.plan);
}
