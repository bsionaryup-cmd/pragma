import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";
import { requireDbUser } from "@/lib/auth";
import { resolveWompiConfig } from "@/modules/billing/services/wompi-credentials";
import { hasPaymentLedgerDelegates } from "@/modules/billing/lib/billing-schema-guard";

export async function getPaymentMethodsAvailability(
  organizationId?: string | null,
) {
  let resolvedOrgId = organizationId ?? null;
  if (!resolvedOrgId) {
    const user = await requireDbUser();
    resolvedOrgId = await getEffectiveOrganizationIdForUser(user.id);
  }

  const wompi = resolvedOrgId
    ? await resolveWompiConfig(resolvedOrgId)
    : { configured: false, env: "test" as const };

  return {
    wompiEnabled: wompi.configured,
    pse: true,
    nequi: true,
    cards: true,
    env: wompi.env,
    ledgerReady: hasPaymentLedgerDelegates(),
  };
}
