import { BillingSubscriptionStatus } from "@prisma/client";

/** Routes always reachable when billing is locked */
export const BILLING_ALLOWED_PATH_PREFIXES = [
  "/settings/billing",
  "/settings/profile",
  "/settings",
  "/api/webhooks/wompi",
  "/api/payments/wompi",
] as const;

/** Sensitive PMS actions blocked when locked */
export const BILLING_LOCKED_BLOCKED_PREFIXES = [
  "/reservations/new",
  "/integrations",
  "/calendar",
  "/finance",
] as const;

export type BillingAccessSnapshot = {
  locked: boolean;
  status: BillingSubscriptionStatus;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  reason: string | null;
};

export function isBillingPathAllowed(pathname: string): boolean {
  return BILLING_ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isBillingRestrictedPath(pathname: string): boolean {
  if (isBillingPathAllowed(pathname)) return false;
  return BILLING_LOCKED_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function resolveBillingLocked(input: {
  status: BillingSubscriptionStatus;
  gracePeriodEndsAt: Date | null;
  billingLockedAt: Date | null;
}): boolean {
  if (input.status === BillingSubscriptionStatus.LOCKED) return true;
  if (input.status === BillingSubscriptionStatus.PAST_DUE) {
    if (!input.gracePeriodEndsAt) return true;
    return input.gracePeriodEndsAt.getTime() < Date.now();
  }
  if (input.billingLockedAt) return true;
  return false;
}
