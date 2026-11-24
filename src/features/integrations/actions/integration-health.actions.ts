"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { isBillingLockedError } from "@/lib/billing/billing-guard";
import { planHasFeature } from "@/lib/billing/plan-entitlements";
import { getOrganizationPlanContextForUser } from "@/lib/billing/organization-plan";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  recoverAllIntegrations,
  recoverIntegration,
} from "@/services/integrations/integration-health/integration-health.service";
import {
  INTEGRATION_HEALTH_PROVIDERS,
  type IntegrationHealthProvider,
  type IntegrationRecoveryResult,
} from "@/services/integrations/integration-health/types";

export type RecoverIntegrationsActionResult = {
  ok: boolean;
  message: string;
  results: IntegrationRecoveryResult[];
};

async function resolveEnabledProviders(
  userId: string,
): Promise<IntegrationHealthProvider[]> {
  const planContext = await getOrganizationPlanContextForUser(userId);
  const plan = planContext?.plan ?? "STARTER";
  return INTEGRATION_HEALTH_PROVIDERS.filter((provider) => {
    switch (provider) {
      case "PRICELABS":
        return planHasFeature(plan, "pricelabs");
      case "TTLOCK":
        return planHasFeature(plan, "ttlock");
      case "SIRE":
        return planHasFeature(plan, "sire");
      case "TRAA":
        return planHasFeature(plan, "traa");
      default:
        return true;
    }
  });
}

function revalidateIntegrations() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/pricelabs");
  revalidatePath("/integrations/ttlock");
  revalidatePath("/integrations/airbnb");
}

/**
 * Recover one provider (`provider` given) or every unhealthy + recoverable one.
 * Requires `integrations:manage`. Idempotent — see recoverIntegration().
 */
export async function recoverIntegrationsAction(
  provider?: IntegrationHealthProvider,
): Promise<RecoverIntegrationsActionResult> {
  try {
    const auth = await requirePermission("integrations:manage");
    const scope = await requireTenantDataScope();
    const enabled = await resolveEnabledProviders(auth.dbUserId);

    if (provider && !enabled.includes(provider)) {
      return {
        ok: false,
        message: "Integración no disponible en tu plan",
        results: [],
      };
    }

    const results = provider
      ? [await recoverIntegration(provider, scope, { canManage: true })]
      : await recoverAllIntegrations(scope, { providers: enabled, canManage: true });

    revalidateIntegrations();

    if (results.length === 0) {
      return { ok: true, message: "Nada que recuperar", results };
    }
    const failed = results.filter((r) => !r.ok && !r.skipped);
    const manual = results.filter((r) => !r.ok && r.skipped);
    const ran = results.filter((r) => !r.skipped).length;
    const parts = [`${ran} recuperación(es) ejecutada(s)`];
    if (failed.length) parts.push(`${failed.length} con error`);
    if (manual.length) parts.push(`${manual.length} requieren acción manual`);
    return { ok: failed.length === 0, message: parts.join(" · "), results };
  } catch (error) {
    if (isBillingLockedError(error)) {
      return { ok: false, message: error.message, results: [] };
    }
    throw error;
  }
}
