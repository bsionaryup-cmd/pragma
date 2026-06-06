import { BillingSubscriptionStatus } from "@prisma/client";

/** Única pantalla del tenant cuando la cuenta está bloqueada por suscripción. */
export const BILLING_PAYWALL_PATH = "/settings/billing";

/** Rutas permitidas con cuenta bloqueada (solo pago / webhooks). */
export const BILLING_LOCKED_ALLOWED_PATH_PREFIXES = [
  BILLING_PAYWALL_PATH,
  "/api/payments/",
  "/api/webhooks/wompi",
  "/api/webhooks/epayco",
] as const;

/** @deprecated Usar BILLING_LOCKED_ALLOWED_PATH_PREFIXES para cuentas bloqueadas. */
export const BILLING_ALLOWED_PATH_PREFIXES = BILLING_LOCKED_ALLOWED_PATH_PREFIXES;

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

export function isBillingLockedAllowedPath(pathname: string): boolean {
  return BILLING_LOCKED_ALLOWED_PATH_PREFIXES.some((prefix) => {
    if (pathname === prefix) return true;
    if (prefix.endsWith("/")) {
      return pathname.startsWith(prefix);
    }
    return pathname.startsWith(`${prefix}/`);
  });
}

/** @deprecated Usar isBillingLockedAllowedPath */
export function isBillingPathAllowed(pathname: string): boolean {
  return isBillingLockedAllowedPath(pathname);
}

export function isBillingRestrictedPath(pathname: string): boolean {
  if (isBillingPathAllowed(pathname)) return false;
  return BILLING_LOCKED_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isTrialExpired(
  status: BillingSubscriptionStatus,
  trialEndsAt: Date | string | null | undefined,
): boolean {
  if (!trialEndsAt) return false;
  const ended =
    status === BillingSubscriptionStatus.TRIAL ||
    status === BillingSubscriptionStatus.LOCKED;
  if (!ended) return false;
  return new Date(trialEndsAt).getTime() < Date.now();
}

export function resolveBillingLocked(input: {
  status: BillingSubscriptionStatus;
  trialEndsAt?: Date | string | null;
  gracePeriodEndsAt: Date | null;
  billingLockedAt: Date | null;
}): boolean {
  if (input.status === BillingSubscriptionStatus.ACTIVE) {
    return false;
  }

  if (input.status === BillingSubscriptionStatus.LOCKED) return true;
  if (input.billingLockedAt) return true;

  if (isTrialExpired(input.status, input.trialEndsAt)) {
    return true;
  }

  if (input.status === BillingSubscriptionStatus.PAST_DUE) {
    if (!input.gracePeriodEndsAt) return true;
    return input.gracePeriodEndsAt.getTime() < Date.now();
  }

  return false;
}

export function resolveBillingLockReason(input: {
  locked: boolean;
  status: BillingSubscriptionStatus;
  trialEndsAt?: Date | string | null;
}): string | null {
  if (!input.locked) return null;

  if (isTrialExpired(input.status, input.trialEndsAt)) {
    return "Tu período de prueba terminó. Realiza el pago de la suscripción para seguir usando PRAGMA.";
  }

  return "Suscripción vencida o pago pendiente. Actualiza tu método de pago para continuar.";
}
