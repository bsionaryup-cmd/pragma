import type { GuestPaymentCategory } from "@prisma/client";

/** Categorías contables para Financial Overview (ingresos operativos). */
export const GUEST_PAYMENT_INCOME_LABELS: Record<GuestPaymentCategory, string> = {
  RESERVATION_FULL: "Reservation Payment",
  DEPOSIT: "Deposit",
  REMAINING_BALANCE: "Remaining Balance",
  DAMAGE_FEE: "Damage Fee",
  CLEANING_FEE: "Cleaning Fee",
  LATE_CHECKOUT: "Late Check-out",
  EXTRA_SERVICES: "Extra Services",
  MANUAL_OPERATIONAL: "Manual Operational Income",
};

export function guestPaymentIncomeLabel(category: GuestPaymentCategory): string {
  return GUEST_PAYMENT_INCOME_LABELS[category] ?? "Payment Link";
}
