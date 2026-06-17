/** Auto-registrado por ensureFinancialEntryForGuestPayment (ver guest-payment-financial-entry.ts). */
const GUEST_PAYMENT_LINK_INCOME_PATTERN = / · link:[a-z0-9]+$/i;

export function isGuestPaymentLinkedOtherIncome(
  description: string | null | undefined,
): boolean {
  if (!description?.trim()) return false;
  return GUEST_PAYMENT_LINK_INCOME_PATTERN.test(description.trim());
}

export function partitionOtherIncomes<T extends { description: string | null }>(
  rows: T[],
): { operational: T[]; guestPaymentMirror: T[] } {
  const operational: T[] = [];
  const guestPaymentMirror: T[] = [];
  for (const row of rows) {
    if (isGuestPaymentLinkedOtherIncome(row.description)) {
      guestPaymentMirror.push(row);
    } else {
      operational.push(row);
    }
  }
  return { operational, guestPaymentMirror };
}
