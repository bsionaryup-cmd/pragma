import type { ReservationPaymentMethod } from "@prisma/client";

const LABELS: Record<ReservationPaymentMethod, string> = {
  PAYMENT_LINK: "Link de pago",
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  OTHER: "Otro",
};

export function reservationPaymentMethodLabel(
  method: ReservationPaymentMethod,
): string {
  return LABELS[method] ?? method;
}
