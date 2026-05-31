import type { GuestPaymentLinkStatus } from "@prisma/client";

const PAID_STATUSES: GuestPaymentLinkStatus[] = ["PAID"];

export type ComputedReservationPaymentBalance = {
  paidAmount: number;
  manualPaidAmount: number;
  linkPaidAmount: number;
  pendingAmount: number;
  remainingBalance: number;
};

export function computeReservationPaymentBalance(input: {
  totalAmount: number;
  links: { amount: number; status: GuestPaymentLinkStatus }[];
  manualPayments: { amount: number }[];
}): ComputedReservationPaymentBalance {
  const linkPaidAmount = input.links
    .filter((link) => PAID_STATUSES.includes(link.status))
    .reduce((sum, link) => sum + Number(link.amount), 0);

  const manualPaidAmount = input.manualPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  const paidAmount = linkPaidAmount + manualPaidAmount;

  const pendingAmount = input.links
    .filter((link) => link.status !== "PAID")
    .reduce((sum, link) => sum + Number(link.amount), 0);

  const remainingBalance = Math.max(
    0,
    input.totalAmount - paidAmount - pendingAmount,
  );

  return {
    paidAmount,
    manualPaidAmount,
    linkPaidAmount,
    pendingAmount,
    remainingBalance,
  };
}
