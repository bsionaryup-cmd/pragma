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

export function isBillingSubscriptionReference(
  reference: string | null | undefined,
): boolean {
  return Boolean(reference?.startsWith("pragma-"));
}
