import { resolvePostAuthHomePath } from "@/lib/auth/role-definitions.server";
import {
  BILLING_PAYWALL_PATH,
  resolveBillingLocked,
} from "@/lib/billing/billing-access";
import { resolveBillingAccountForUserId } from "@/lib/billing/resolve-billing-account";
import type { User } from "@prisma/client";

/** Ruta única permitida cuando la suscripción está bloqueada. */
export { BILLING_PAYWALL_PATH };

export async function resolvePostAuthHomePathForUser(user: User): Promise<string> {
  const base = resolvePostAuthHomePath(user);
  if (base === "/onboarding" || base.startsWith("/owner")) {
    return base;
  }

  // Resolve billing by the authenticated DB user — do not rely on a second
  // auth() hop that can miss cookies right after login and mis-route to paywall.
  const account = await resolveBillingAccountForUserId(user.id);
  if (!account) {
    return base;
  }

  // Paid / active tenants must never land on the activation paywall.
  if (account.status === "ACTIVE" && !account.billingLockedAt) {
    return base;
  }

  const locked = resolveBillingLocked({
    status: account.status,
    trialEndsAt: account.trialEndsAt,
    gracePeriodEndsAt: account.gracePeriodEndsAt,
    billingLockedAt: account.billingLockedAt,
  });

  if (locked) {
    return BILLING_PAYWALL_PATH;
  }

  return base;
}
