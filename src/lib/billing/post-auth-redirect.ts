import { resolvePostAuthHomePath } from "@/lib/auth/role-definitions.server";
import { BILLING_PAYWALL_PATH } from "@/lib/billing/billing-access";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import type { User } from "@prisma/client";

/** Ruta única permitida cuando la suscripción está bloqueada. */
export { BILLING_PAYWALL_PATH };

export async function resolvePostAuthHomePathForUser(user: User): Promise<string> {
  const base = resolvePostAuthHomePath(user);
  if (base === "/onboarding" || base.startsWith("/owner")) {
    return base;
  }

  const access = await getBillingAccessSnapshot();
  if (access.locked) {
    return BILLING_PAYWALL_PATH;
  }

  return base;
}
