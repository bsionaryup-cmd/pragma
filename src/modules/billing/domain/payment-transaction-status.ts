/** Valores del enum Prisma `PaymentTransactionStatus` (sin importar @prisma/client en runtime). */
export const PAYMENT_TRANSACTION_STATUSES = [
  "PENDING",
  "APPROVED",
  "DECLINED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
] as const;

export type PaymentTransactionStatusValue =
  (typeof PAYMENT_TRANSACTION_STATUSES)[number];
