export const GUEST_PAYMENT_REFERENCE_PREFIX = "guest-";

export function buildGuestPaymentReference(linkId: string): string {
  return `${GUEST_PAYMENT_REFERENCE_PREFIX}${linkId}`;
}

export function parseGuestPaymentReference(
  reference: string | null | undefined,
): string | null {
  if (!reference?.startsWith(GUEST_PAYMENT_REFERENCE_PREFIX)) return null;
  const id = reference.slice(GUEST_PAYMENT_REFERENCE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

export function isGuestPaymentReference(reference: string | null | undefined): boolean {
  return parseGuestPaymentReference(reference) !== null;
}

const BILLING_SUBSCRIPTION_REFERENCE_PREFIX = "pragma-";

export function buildBillingSubscriptionReference(invoiceId: string): string {
  return `${BILLING_SUBSCRIPTION_REFERENCE_PREFIX}${invoiceId}`;
}

export function parseBillingSubscriptionReference(
  reference: string | null | undefined,
): string | null {
  if (!reference?.startsWith(BILLING_SUBSCRIPTION_REFERENCE_PREFIX)) return null;
  const id = reference.slice(BILLING_SUBSCRIPTION_REFERENCE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

export function isBillingSubscriptionReference(
  reference: string | null | undefined,
): boolean {
  return parseBillingSubscriptionReference(reference) !== null;
}
